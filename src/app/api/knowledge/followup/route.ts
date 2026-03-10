import { NextRequest } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { getExpandSystemPrompt } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, summary, difficulty, details, question } = body;

    if (!title || !question) {
      return new Response(
        JSON.stringify({ error: "Title and question are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const settings = await prisma.settings.findFirst();
        const openai = new OpenAI({
          apiKey: settings?.apiKey || "",
          baseURL: "https://api.deerapi.com/v1",
        });

        const systemPrompt = getExpandSystemPrompt() + `

## 追问模式

用户对上述知识点有一个具体问题。请针对这个问题生成 1-3 个子知识点作为回答。
每个子知识点的标题应该体现问题的方向，内容应该直接回答用户的疑问。
保持之前要求的 JSON 格式输出。`;

        const userPrompt = `父知识点标题：${title}
父知识点难度：${difficulty || "basic"}
父知识点概述：${summary || ""}
父知识点详情：${details || ""}

用户追问：${question}

请针对用户的问题，生成 1-3 个有针对性的子知识点来回答这个问题。
严格按照系统提示中要求的 JSON 格式输出，只包含 items 字段。`;

        const stream = await openai.chat.completions.create({
          model: settings?.model || "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: true,
        });

        let accumulated = "";
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          accumulated += content;
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
          );
        }

        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, fullContent: accumulated })}\n\n`
          )
        );
      } catch (error) {
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({ error: String(error) })}\n\n`
          )
        );
      } finally {
        await writer.close();
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
    return new Response(
      JSON.stringify({ error: "Failed to start follow-up" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
