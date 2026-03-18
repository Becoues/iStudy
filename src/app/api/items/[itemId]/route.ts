import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** DELETE /api/items/[itemId] — delete a single knowledge item and its descendants */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;

    const item = await prisma.knowledgeItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const moduleId = item.moduleId;

    // Recursively collect all descendant IDs
    async function collectDescendantIds(parentId: string): Promise<string[]> {
      const children = await prisma.knowledgeItem.findMany({
        where: { parentId },
        select: { id: true },
      });
      const ids: string[] = [];
      for (const child of children) {
        ids.push(child.id);
        ids.push(...(await collectDescendantIds(child.id)));
      }
      return ids;
    }

    const descendantIds = await collectDescendantIds(itemId);
    const allIds = [itemId, ...descendantIds];

    // Delete comments first, then items
    await prisma.comment.deleteMany({ where: { itemId: { in: allIds } } });
    // Delete from leaves up — children first
    for (const id of allIds.reverse()) {
      await prisma.knowledgeItem.delete({ where: { id } });
    }

    // Update module item count
    const remaining = await prisma.knowledgeItem.count({ where: { moduleId } });
    await prisma.knowledgeModule.update({
      where: { id: moduleId },
      data: { itemCount: remaining },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete item:", error);
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 }
    );
  }
}

/** PATCH /api/items/[itemId] — reorder: move item up or down among siblings */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const { direction } = (await request.json()) as {
      direction: "up" | "down";
    };

    const item = await prisma.knowledgeItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Get siblings (same parentId & moduleId), sorted by orderIndex
    const siblings = await prisma.knowledgeItem.findMany({
      where: { moduleId: item.moduleId, parentId: item.parentId },
      orderBy: { orderIndex: "asc" },
    });

    const idx = siblings.findIndex((s) => s.id === itemId);
    if (idx === -1) {
      return NextResponse.json({ error: "Item not in siblings" }, { status: 400 });
    }

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) {
      // Already at boundary
      return NextResponse.json({ success: true, noChange: true });
    }

    // Swap orderIndex values
    const current = siblings[idx];
    const target = siblings[swapIdx];

    await prisma.knowledgeItem.update({
      where: { id: current.id },
      data: { orderIndex: target.orderIndex },
    });
    await prisma.knowledgeItem.update({
      where: { id: target.id },
      data: { orderIndex: current.orderIndex },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder item:", error);
    return NextResponse.json(
      { error: "Failed to reorder item" },
      { status: 500 }
    );
  }
}
