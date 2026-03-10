import { NextRequest } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { getExpandSystemPrompt, getExpandUserPrompt } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, summary, difficulty, details } = body;

    if (!title) {
      return new Response(
        JSON.stringify({ error: "Title is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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

        const stream = await openai.chat.completions.create({
          model: settings?.model || "gpt-4o",
          messages: [
            { role: "system", content: getExpandSystemPrompt() },
            {
              role: "user",
              content: getExpandUserPrompt(
                title,
                summary || "",
                difficulty || "basic",
                details || ""
              ),
            },
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
      JSON.stringify({ error: "Failed to start expansion" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
