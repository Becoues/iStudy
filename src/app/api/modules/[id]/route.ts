import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // Escape raw control characters that break JSON parsing
    const sanitized = text
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    return JSON.parse(sanitized);
  }
}

interface KnowledgeItemWithChildren {
  id: string;
  moduleId: string;
  parentId: string | null;
  orderIndex: number;
  title: string;
  difficulty: string;
  content: string;
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
    content: string;
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
          include: {
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
