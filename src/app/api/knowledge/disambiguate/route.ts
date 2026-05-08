import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import {
  getDisambiguateSystemPrompt,
  getDisambiguateUserPrompt,
  sanitizeTopic,
} from "@/lib/prompts";

interface DisambiguateOption {
  label: string;
  description: string;
  domain: string;
}

interface DisambiguateResponse {
  ambiguous: boolean;
  options?: DisambiguateOption[];
}

function isOption(x: unknown): x is DisambiguateOption {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.label === "string" &&
    typeof o.description === "string" &&
    typeof o.domain === "string"
  );
}

function parseDisambiguateOutput(text: string): DisambiguateResponse {
  // Strip optional markdown fences
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "");

  // Extract first JSON object via brace matching
  const start = cleaned.indexOf("{");
  let end = -1;
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "{") depth++;
      else if (cleaned[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
  }
  const jsonText = end !== -1 ? cleaned.slice(start, end + 1) : cleaned;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ambiguous: false };
  }

  if (!parsed || typeof parsed !== "object") return { ambiguous: false };
  const obj = parsed as Record<string, unknown>;
  if (obj.ambiguous !== true) return { ambiguous: false };

  const opts = Array.isArray(obj.options) ? obj.options.filter(isOption) : [];
  if (opts.length < 2) return { ambiguous: false };

  return { ambiguous: true, options: opts.slice(0, 5) };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawTopic = typeof body?.topic === "string" ? body.topic : "";
    const topic = sanitizeTopic(rawTopic);

    if (!topic) {
      return NextResponse.json({ error: "topic 必填" }, { status: 400 });
    }

    const settings = await prisma.settings.findFirst();
    if (!settings?.apiKey) {
      // No API key — gracefully degrade to non-ambiguous so the caller can proceed
      return NextResponse.json({ ambiguous: false });
    }

    const openai = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: "https://api.deerapi.com/v1",
    });

    const completion = await openai.chat.completions.create({
      model: settings.model || "gpt-5.4",
      messages: [
        { role: "system", content: getDisambiguateSystemPrompt() },
        { role: "user", content: getDisambiguateUserPrompt(topic) },
      ],
      // Small response — no streaming, low temperature for stable judgement
      temperature: 0.2,
    });

    const text = completion.choices[0]?.message?.content || "";
    const result = parseDisambiguateOutput(text);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[disambiguate] failed:", error);
    // Fail-open: treat as not ambiguous so the user flow still works
    return NextResponse.json({ ambiguous: false });
  }
}
