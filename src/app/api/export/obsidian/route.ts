import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";

interface ExportRequest {
  moduleId: string;
  itemId?: string;
  aiPolish: boolean;
  includeQuiz: boolean;
}

interface ParsedItem {
  title: string;
  summary: string;
  details: string;
  mermaid: string | null;
  quiz?: {
    question: string;
    options: string[];
    hint: string;
    answer: string;
    explanation: string;
  };
  imageUrl?: string;
}

interface TreeItem {
  id: string;
  parentId: string | null;
  orderIndex: number;
  title: string;
  content: string;
  depth: number;
  children?: TreeItem[];
}

function safeParseJson(content: string): ParsedItem {
  try {
    return JSON.parse(content);
  } catch {
    return {
      title: "",
      summary: "",
      details: content,
      mermaid: null,
    };
  }
}

function buildTree(items: TreeItem[]): TreeItem[] {
  const map = new Map<string, TreeItem>();
  const roots: TreeItem[] = [];
  for (const item of items) {
    map.set(item.id, { ...item, children: [] });
  }
  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function itemToMarkdown(
  item: TreeItem,
  headingLevel: number,
  includeQuiz: boolean
): string {
  const parsed = safeParseJson(item.content);
  const heading = "#".repeat(Math.min(headingLevel, 6));
  const lines: string[] = [];

  lines.push(`${heading} ${parsed.title}`);
  lines.push("");

  if (parsed.summary) {
    lines.push(`> ${parsed.summary}`);
    lines.push("");
  }

  if (parsed.details) {
    lines.push(parsed.details);
    lines.push("");
  }

  if (parsed.mermaid) {
    lines.push("```mermaid");
    lines.push(parsed.mermaid);
    lines.push("```");
    lines.push("");
  }

  if (includeQuiz && parsed.quiz) {
    lines.push(`> [!question] 测验：${parsed.quiz.question}`);
    for (const opt of parsed.quiz.options) {
      lines.push(`> - ${opt}`);
    }
    lines.push(">");
    lines.push(`> > [!success]- 答案`);
    lines.push(`> > **${parsed.quiz.answer}**`);
    if (parsed.quiz.explanation) {
      lines.push(`> > ${parsed.quiz.explanation}`);
    }
    lines.push("");
  }

  // Recursive children
  if (item.children && item.children.length > 0) {
    for (const child of item.children) {
      lines.push(itemToMarkdown(child, headingLevel + 1, includeQuiz));
    }
  }

  return lines.join("\n");
}

function findItemInTree(items: TreeItem[], id: string): TreeItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemInTree(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { moduleId, itemId, aiPolish, includeQuiz } =
      (await request.json()) as ExportRequest;

    if (!moduleId) {
      return NextResponse.json(
        { error: "moduleId 为必填项" },
        { status: 400 }
      );
    }

    // Fetch module with all items
    const module = await prisma.knowledgeModule.findUnique({
      where: { id: moduleId },
      include: {
        items: { orderBy: { orderIndex: "asc" } },
      },
    });

    if (!module) {
      return NextResponse.json({ error: "模块不存在" }, { status: 404 });
    }

    const tags: string[] = JSON.parse(module.tags);
    const tree = buildTree(module.items as unknown as TreeItem[]);

    // Fetch settings once for both AI polish and Obsidian path
    const settings = await prisma.settings.findFirst();

    let targetItems: TreeItem[];
    let filename: string;

    if (itemId) {
      const found = findItemInTree(tree, itemId);
      if (!found) {
        return NextResponse.json(
          { error: "知识点不存在" },
          { status: 404 }
        );
      }
      targetItems = [found];
      const parsed = safeParseJson(found.content);
      filename = `${module.topic} - ${parsed.title}.md`;
    } else {
      targetItems = tree;
      filename = `${module.topic}.md`;
    }

    // Build frontmatter
    const frontmatter = [
      "---",
      `tags: [${tags.join(", ")}]`,
      `source: iStudy`,
      `created: ${new Date().toISOString().split("T")[0]}`,
      `topic: ${module.topic}`,
      "---",
      "",
    ].join("\n");

    // Build body
    const bodyParts: string[] = [];
    if (!itemId) {
      bodyParts.push(`# ${module.topic}`);
      bodyParts.push("");
    }
    for (const item of targetItems) {
      const headingLevel = itemId ? 1 : 2;
      bodyParts.push(itemToMarkdown(item, headingLevel, includeQuiz));
    }

    let content = frontmatter + bodyParts.join("\n");

    // AI Polish
    if (aiPolish) {
      if (!settings?.apiKey) {
        return NextResponse.json(
          { error: "请先在设置中配置 API Key" },
          { status: 400 }
        );
      }

      const openai = new OpenAI({
        apiKey: settings.apiKey,
        baseURL: "https://api.deerapi.com/v1",
      });

      const polishResponse = await openai.chat.completions.create({
        model: "gemini-3.1-flash-lite-preview",
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的学习笔记编辑。请将以下结构化知识笔记润色为流畅自然、适合 Obsidian 阅读的学习笔记。要求：1. 保留所有关键信息、代码块、数学公式和 Mermaid 图表 2. 保留 YAML frontmatter 不要修改 3. 让文字更连贯可读，适当添加过渡句 4. 保持 Markdown 格式 5. 保留 Obsidian callout 语法（> [!question] 等）6. 输出纯 Markdown，不要添加代码围栏",
          },
          {
            role: "user",
            content: `请润色以下学习笔记：\n\n${content}`,
          },
        ],
      });

      const polished = polishResponse.choices[0]?.message?.content;
      if (polished) {
        content = polished;
      }
    }

    // Sanitize filename
    const safeFilename = filename.replace(/[/\\:*?"<>|]/g, "_");

    // Read Obsidian path from settings — write directly into obsidianPath, no subfolder
    const obsidianDir = settings?.obsidianPath || "/Users/mac/Documents/Main/AI_talking";

    // Write to Obsidian directory
    await fs.mkdir(obsidianDir, { recursive: true });
    const filePath = path.join(obsidianDir, safeFilename);
    await fs.writeFile(filePath, content, "utf-8");

    return NextResponse.json({
      success: true,
      filename: safeFilename,
      filePath,
    });
  } catch (error) {
    console.error("Export to Obsidian failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "导出到 Obsidian 失败",
      },
      { status: 500 }
    );
  }
}
