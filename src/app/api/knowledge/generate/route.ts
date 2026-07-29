import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createLLMClient, DEFAULT_MODEL } from "@/lib/llm";
import {
  getOutlineSystemPrompt,
  getOutlineUserPrompt,
  getDetailSystemPrompt,
  getDetailUserPrompt,
} from "@/lib/prompts";

/** Concurrency cap for the per-item detail calls. */
const DETAIL_CONCURRENCY = 3;

interface OutlineItem {
  title: string;
  summary: string;
  difficulty: "basic" | "intermediate" | "advanced";
}

interface OutlineResult {
  tags: string[];
  items: OutlineItem[];
}

interface DetailItem {
  details: string;
  mermaid: string | null;
  quiz: {
    question: string;
    options: string[];
    hint: string;
    answer: string;
    explanation: string;
  };
  references: { title: string; url: string }[];
}

/** Strip optional ```json fences and pull the first JSON object via brace matching. */
function extractJson(text: string): string | null {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "");
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return null;
}

function isValidDifficulty(x: unknown): x is OutlineItem["difficulty"] {
  return x === "basic" || x === "intermediate" || x === "advanced";
}

function parseOutline(raw: string): OutlineResult {
  const json = extractJson(raw);
  if (!json) throw new Error("outline: no JSON found in model output");
  const parsed = JSON.parse(json) as Record<string, unknown>;

  if (!Array.isArray(parsed.tags)) throw new Error("outline: missing tags");
  if (!Array.isArray(parsed.items)) throw new Error("outline: missing items");

  const items: OutlineItem[] = [];
  for (const raw of parsed.items as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.title !== "string" || !o.title.trim()) continue;
    if (typeof o.summary !== "string") continue;
    const difficulty = isValidDifficulty(o.difficulty) ? o.difficulty : "basic";
    items.push({
      title: o.title.trim(),
      summary: o.summary,
      difficulty,
    });
  }
  if (items.length === 0) throw new Error("outline: zero valid items");

  const tags = (parsed.tags as unknown[])
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .slice(0, 8);

  return { tags, items: items.slice(0, 10) };
}

function parseDetail(raw: string): DetailItem {
  const json = extractJson(raw);
  if (!json) throw new Error("detail: no JSON found in model output");
  const parsed = JSON.parse(json) as Record<string, unknown>;

  const details = typeof parsed.details === "string" ? parsed.details : "";
  const mermaid =
    typeof parsed.mermaid === "string" && parsed.mermaid.trim().length > 0
      ? parsed.mermaid
      : null;

  const quizRaw = (parsed.quiz ?? {}) as Record<string, unknown>;
  const quiz = {
    question: typeof quizRaw.question === "string" ? quizRaw.question : "",
    options: Array.isArray(quizRaw.options)
      ? (quizRaw.options as unknown[]).filter(
          (x): x is string => typeof x === "string"
        )
      : [],
    hint: typeof quizRaw.hint === "string" ? quizRaw.hint : "",
    answer: typeof quizRaw.answer === "string" ? quizRaw.answer : "A",
    explanation:
      typeof quizRaw.explanation === "string" ? quizRaw.explanation : "",
  };

  const references = Array.isArray(parsed.references)
    ? (parsed.references as unknown[])
        .filter(
          (r): r is { title: string; url: string } =>
            !!r &&
            typeof r === "object" &&
            typeof (r as { title: unknown }).title === "string" &&
            typeof (r as { url: unknown }).url === "string"
        )
        .slice(0, 6)
    : [];

  return { details, mermaid, quiz, references };
}

function fallbackDetail(item: OutlineItem): DetailItem {
  return {
    details: `## ${item.title}\n\n${item.summary}\n\n（生成此节详情时遇到问题，可在条目页面尝试重新生成。）`,
    mermaid: null,
    quiz: {
      question: `关于「${item.title}」，下列说法最贴近其核心要点的是？`,
      options: [
        "A. 见正文概述",
        "B. 与该主题无关",
        "C. 完全相反的概念",
        "D. 无法判断",
      ],
      hint: "回顾上方的概述与详情",
      answer: "A",
      explanation: "选项 A 与该知识点的概述一致；其他选项要么不相关要么与定义相反。",
    },
    references: [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic } = body;

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return new Response(
        JSON.stringify({ error: "Topic is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const safeWrite = async (data: string) => {
      try {
        await writer.write(encoder.encode(data));
      } catch {
        /* writer closed */
      }
    };
    const safeClose = async () => {
      try {
        await writer.close();
      } catch {
        /* already closed */
      }
    };
    const writeChunk = (text: string) =>
      safeWrite(`data: ${JSON.stringify({ content: text })}\n\n`);

    // Fire and forget — orchestrate outline + parallel details
    (async () => {
      try {
        const settings = await prisma.settings.findFirst();
        if (!settings?.apiKey) {
          await safeWrite(
            `data: ${JSON.stringify({ error: "请先在设置中配置 API Key" })}\n\n`
          );
          return;
        }
        const openai = createLLMClient(settings);
        const model = settings.model || DEFAULT_MODEL;

        // ---------- Phase 1: outline ----------
        const outlineCompletion = await openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: getOutlineSystemPrompt() },
            { role: "user", content: getOutlineUserPrompt(topic) },
          ],
          temperature: 0.3,
        });

        const outlineText =
          outlineCompletion.choices[0]?.message?.content || "";
        const outline = parseOutline(outlineText);
        const titles = outline.items.map((i) => i.title);

        // Stream the JSON envelope opening immediately so the client sees
        // tags + structure right after phase 1 finishes.
        await writeChunk(
          `{"tags":${JSON.stringify(outline.tags)},"items":[`
        );

        // ---------- Phase 2: parallel details ----------
        const finished: Array<DetailItem & OutlineItem> = new Array(
          outline.items.length
        );
        let firstEmitted = true;
        let next = 0;

        const fillItem = async (idx: number) => {
          const item = outline.items[idx];
          let detail: DetailItem;
          try {
            const completion = await openai.chat.completions.create({
              model,
              messages: [
                { role: "system", content: getDetailSystemPrompt() },
                {
                  role: "user",
                  content: getDetailUserPrompt(topic, item, titles),
                },
              ],
              temperature: 0.4,
            });
            const text = completion.choices[0]?.message?.content || "";
            detail = parseDetail(text);
          } catch (err) {
            console.error(`[generate] detail item ${idx} (${item.title}) failed:`, err);
            detail = fallbackDetail(item);
          }

          const fullItem = { ...item, ...detail };
          finished[idx] = fullItem;

          // Emit chunk in completion order (UX feedback). The final
          // fullContent in the done event will hold items in outline order.
          const json = JSON.stringify(fullItem);
          const chunk = firstEmitted ? json : `,${json}`;
          firstEmitted = false;
          await writeChunk(chunk);
        };

        const worker = async () => {
          while (true) {
            const idx = next++;
            if (idx >= outline.items.length) return;
            await fillItem(idx);
          }
        };

        const concurrency = Math.min(DETAIL_CONCURRENCY, outline.items.length);
        await Promise.all(
          Array.from({ length: concurrency }, () => worker())
        );

        // Close envelope
        await writeChunk("]}");

        // Final done event with the canonical, outline-ordered JSON.
        const fullJson = JSON.stringify({
          tags: outline.tags,
          items: finished,
        });
        await safeWrite(
          `data: ${JSON.stringify({ done: true, fullContent: fullJson })}\n\n`
        );
      } catch (error) {
        console.error("[generate] orchestration failed:", error);
        // Surface upstream quota / auth errors more clearly without leaking stacks.
        const message = (() => {
          if (error instanceof Error) {
            const m = error.message.toLowerCase();
            if (m.includes("quota") || m.includes("额度"))
              return "API 额度不足，请到设置中切换 Key 或前往 CometAPI 充值";
            if (m.includes("401") || m.includes("unauthor"))
              return "API Key 无效或未授权，请检查设置";
            if (m.includes("429"))
              return "请求过于频繁，请稍后再试";
          }
          return "知识生成失败，请稍后重试";
        })();
        await safeWrite(`data: ${JSON.stringify({ error: message })}\n\n`);
      } finally {
        await safeClose();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[generate] route fatal:", error);
    return new Response(
      JSON.stringify({ error: "Failed to start generation" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
