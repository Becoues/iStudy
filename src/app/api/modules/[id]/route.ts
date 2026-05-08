import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Escape raw control characters that break JSON parsing
    const sanitized = text
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    try {
      return JSON.parse(sanitized);
    } catch {
      // Last-resort fallback: return the raw text so callers can still
      // round-trip it without a 500 — downstream code expects `unknown`.
      return text;
    }
  }
}

interface KnowledgeItemWithChildren {
  id: string;
  moduleId: string;
  parentId: string | null;
  orderIndex: number;
  title: string;
  difficulty: string;
  content: unknown;
  depth: number;
  createdAt: Date;
  commentCount: number;
  children: KnowledgeItemWithChildren[];
}

function buildTree(
  items: {
    id: string;
    moduleId: string;
    parentId: string | null;
    orderIndex: number;
    title: string;
    difficulty: string;
    content: unknown;
    depth: number;
    createdAt: Date;
    commentCount: number;
  }[]
): KnowledgeItemWithChildren[] {
  const itemMap = new Map<string, KnowledgeItemWithChildren>();
  const roots: KnowledgeItemWithChildren[] = [];

  // Create map entries with empty children arrays
  for (const item of items) {
    itemMap.set(item.id, { ...item, children: [] });
  }

  // Build tree structure
  for (const item of items) {
    const node = itemMap.get(item.id)!;
    if (item.parentId && itemMap.has(item.parentId)) {
      itemMap.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by orderIndex
  const sortChildren = (nodes: KnowledgeItemWithChildren[]) => {
    nodes.sort((a, b) => a.orderIndex - b.orderIndex);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const module = await prisma.knowledgeModule.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { orderIndex: "asc" },
          // Narrow the columns we read — content is a large JSON blob and we
          // need only the fields buildTree consumes.
          select: {
            id: true,
            moduleId: true,
            parentId: true,
            orderIndex: true,
            title: true,
            difficulty: true,
            content: true,
            depth: true,
            createdAt: true,
            _count: { select: { comments: true } },
          },
        },
      },
    });

    if (!module) {
      return NextResponse.json(
        { error: "Module not found" },
        { status: 404 }
      );
    }

    const itemsWithParsedContent = module.items.map((item) => ({
      ...item,
      content: safeParseJson(item.content),
      commentCount: item._count.comments,
    }));

    const tree = buildTree(itemsWithParsedContent);

    return NextResponse.json({
      ...module,
      tags: JSON.parse(module.tags),
      items: tree,
    });
  } catch (error) {
    console.error("Failed to fetch module:", error);
    return NextResponse.json(
      { error: "Failed to fetch module" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { topic, tags } = body;

    const data: Record<string, unknown> = {};
    if (topic !== undefined) {
      if (typeof topic !== "string" || !topic.trim()) {
        return NextResponse.json({ error: "topic must be a non-empty string" }, { status: 400 });
      }
      data.topic = topic.trim();
    }
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
      }
      data.tags = JSON.stringify(tags);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.knowledgeModule.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      id: updated.id,
      topic: updated.topic,
      tags: JSON.parse(updated.tags),
    });
  } catch {
    return NextResponse.json({ error: "Failed to update module" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const module = await prisma.knowledgeModule.findUnique({
      where: { id },
    });

    if (!module) {
      return NextResponse.json(
        { error: "Module not found" },
        { status: 404 }
      );
    }

    await prisma.knowledgeModule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete module" },
      { status: 500 }
    );
  }
}
