import { NextRequest } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { getCondenseSystemPrompt, getCondenseUserPrompt } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { moduleId, messages } = body;

    if (!moduleId || !messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "moduleId and messages are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify module exists
    const knowledgeModule= await prisma.knowledgeModule.findUnique({
      where: { id: moduleId },
    });

    if (!knowledgeModule) {
      return new Response(
        JSON.stringify({ error: "Module not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const settings = await prisma.settings.findFirst();
    const openai = new OpenAI({
      apiKey: settings?.apiKey || "",
      baseURL: "https://api.deerapi.com/v1",
    });

    const response = await openai.chat.completions.create({
      model: settings?.model || "gpt-5.4",
      messages: [
        { role: "system", content: getCondenseSystemPrompt() },
        { role: "user", content: getCondenseUserPrompt(messages) },
      ],
    });

    const rawContent = response.choices[0]?.message?.content || "";

    // Parse JSON from AI response — handle possible markdown fences
    let jsonStr = rawContent.trim();
    // Strip markdown code fences if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback: try to extract JSON between first { and last }
      const firstBrace = jsonStr.indexOf("{");
      const lastBrace = jsonStr.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        parsed = JSON.parse(jsonStr.slice(firstBrace, lastBrace + 1));
      } else {
        return new Response(
          JSON.stringify({ error: "Failed to parse AI response as JSON" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Validate required fields
    if (!parsed.title || !parsed.summary || !parsed.details || !parsed.difficulty) {
      return new Response(
        JSON.stringify({
          error: "AI response missing required fields (title, summary, details, difficulty)",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate difficulty value
    if (!["basic", "intermediate", "advanced"].includes(parsed.difficulty)) {
      parsed.difficulty = "intermediate";
    }

    // Normalize optional fields
    if (!parsed.mermaid) parsed.mermaid = null;
    if (!parsed.quiz) parsed.quiz = null;
    if (!parsed.references) parsed.references = [];

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to condense conversation: " + String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
