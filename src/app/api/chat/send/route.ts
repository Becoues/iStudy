import { NextRequest } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { getChatSystemPrompt } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { moduleId, messages, context } = body;

    if (!moduleId || !messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "moduleId and messages are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch module data for context
    const knowledgeModule= await prisma.knowledgeModule.findUnique({
      where: { id: moduleId },
      include: {
        items: {
          select: { title: true, content: true },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!knowledgeModule) {
      return new Response(
        JSON.stringify({ error: "Module not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract summaries from item content JSON
    const itemSummaries = knowledgeModule.items.map((item) => {
      try {
        const parsed = JSON.parse(item.content);
        return { title: item.title, summary: parsed.summary || "" };
      } catch {
        return { title: item.title, summary: "" };
      }
    });

    // Build system prompt, optionally with focused item context
    let systemPrompt = getChatSystemPrompt(knowledgeModule.topic, itemSummaries);
    if (context?.focusedItem) {
      systemPrompt += `\n\n【当前聚焦知识点】\n标题：${context.focusedItem.title}\n摘要：${context.focusedItem.summary}\n详情：${context.focusedItem.details}\n\n请优先围绕该知识点回答用户问题。`;
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Fire and forget
    (async () => {
      try {
        const settings = await prisma.settings.findFirst();
        const openai = new OpenAI({
          apiKey: settings?.apiKey || "",
          baseURL: "https://api.deerapi.com/v1",
        });

        const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        const stream = await openai.chat.completions.create({
          model: settings?.model || "gpt-4o",
          messages: chatMessages,
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
      JSON.stringify({ error: "Failed to start chat" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
