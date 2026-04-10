import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** Max nesting depth for knowledge items */
const MAX_DEPTH = 3;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const knowledgeModule = await prisma.knowledgeModule.findUnique({
      where: { id },
    });

    if (!knowledgeModule) {
      return NextResponse.json(
        { error: "Module not found" },
        { status: 404 }
      );
    }

    // --- Single-item creation mode ---
    // Detected when body has `title` (single item) instead of `items` (batch)
    if ("title" in body && !("items" in body)) {
      const {
        title,
        content,
        parentId = null,
        orderIndex,
        difficulty = "basic",
      } = body as {
        title: string;
        content: object | string;
        parentId?: string | null;
        orderIndex?: number;
        difficulty?: string;
      };

      if (!title) {
        return NextResponse.json(
          { error: "Title is required" },
          { status: 400 }
        );
      }

      // Validate parent exists and compute depth
      let depth = 0;
      if (parentId) {
        const parent = await prisma.knowledgeItem.findUnique({
          where: { id: parentId },
          select: { id: true, depth: true, moduleId: true },
        });
        if (!parent) {
          return NextResponse.json(
            { error: "Parent item not found" },
            { status: 404 }
          );
        }
        if (parent.moduleId !== id) {
          return NextResponse.json(
            { error: "Parent must be in the same module" },
            { status: 400 }
          );
        }
        depth = parent.depth + 1;
        if (depth >= MAX_DEPTH) {
          return NextResponse.json(
            { error: `Maximum nesting depth of ${MAX_DEPTH} exceeded` },
            { status: 400 }
          );
        }
      }

      // Determine orderIndex: use provided value or append at end
      let finalOrderIndex = orderIndex;
      if (finalOrderIndex === undefined) {
        const maxSibling = await prisma.knowledgeItem.findFirst({
          where: { moduleId: id, parentId },
          orderBy: { orderIndex: "desc" },
          select: { orderIndex: true },
        });
        finalOrderIndex = (maxSibling?.orderIndex ?? -1) + 1;
      } else {
        // Shift existing siblings at or after this index to make room
        const siblingsToShift = await prisma.knowledgeItem.findMany({
          where: {
            moduleId: id,
            parentId,
            orderIndex: { gte: finalOrderIndex },
          },
          orderBy: { orderIndex: "desc" },
          select: { id: true, orderIndex: true },
        });
        for (const s of siblingsToShift) {
          await prisma.knowledgeItem.update({
            where: { id: s.id },
            data: { orderIndex: s.orderIndex + 1 },
          });
        }
      }

      const contentStr =
        typeof content === "string" ? content : JSON.stringify(content);

      const created = await prisma.knowledgeItem.create({
        data: {
          moduleId: id,
          parentId,
          title,
          content: contentStr,
          difficulty,
          orderIndex: finalOrderIndex,
          depth,
        },
      });

      // Update module item count
      const totalItems = await prisma.knowledgeItem.count({
        where: { moduleId: id },
      });
      await prisma.knowledgeModule.update({
        where: { id },
        data: { itemCount: totalItems },
      });

      // Return full item with parsed content for frontend local insert
      let parsedContent;
      try {
        parsedContent = JSON.parse(created.content);
      } catch {
        parsedContent = created.content;
      }

      return NextResponse.json(
        {
          id: created.id,
          moduleId: created.moduleId,
          parentId: created.parentId,
          orderIndex: created.orderIndex,
          title: created.title,
          difficulty: created.difficulty,
          content: parsedContent,
          depth: created.depth,
          commentCount: 0,
          children: [],
        },
        { status: 201 }
      );
    }

    // --- Batch creation mode (existing behavior) ---
    const { parentId, items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items array is required and must not be empty" },
        { status: 400 }
      );
    }

    // If parentId is provided, verify it exists
    if (parentId) {
      const parent = await prisma.knowledgeItem.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent item not found" },
          { status: 404 }
        );
      }
    }

    // Create all items
    const createdItems = await Promise.all(
      items.map(
        (
          item: {
            title: string;
            content: string;
            difficulty?: string;
            orderIndex?: number;
            depth?: number;
          },
          index: number
        ) =>
          prisma.knowledgeItem.create({
            data: {
              moduleId: id,
              parentId: parentId || null,
              title: item.title,
              content: item.content,
              difficulty: item.difficulty || "basic",
              orderIndex: item.orderIndex ?? index,
              depth: item.depth || 0,
            },
          })
      )
    );

    // Update module item count
    const totalItems = await prisma.knowledgeItem.count({
      where: { moduleId: id },
    });

    await prisma.knowledgeModule.update({
      where: { id },
      data: { itemCount: totalItems },
    });

    return NextResponse.json(createdItems, { status: 201 });
  } catch (error) {
    console.error("Failed to add items:", error);
    return NextResponse.json(
      { error: "Failed to add items" },
      { status: 500 }
    );
  }
}
