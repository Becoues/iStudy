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

    // Collect all descendants level-by-level (batched, no N+1)
    const descendantIds: string[] = [];
    let frontier: string[] = [itemId];
    while (frontier.length > 0) {
      const children = await prisma.knowledgeItem.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      const ids = children.map((c) => c.id);
      if (ids.length === 0) break;
      descendantIds.push(...ids);
      frontier = ids;
    }
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

/** Max nesting depth allowed for knowledge items */
const MAX_DEPTH = 3;

/**
 * Collect all descendant IDs of a given item (for circular reference check).
 */
async function collectDescendantIdsOf(parentId: string): Promise<Set<string>> {
  const result = new Set<string>();
  let frontier: string[] = [parentId];
  while (frontier.length > 0) {
    const children = await prisma.knowledgeItem.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    if (children.length === 0) break;
    const ids = children.map((c) => c.id);
    for (const id of ids) result.add(id);
    frontier = ids;
  }
  return result;
}

/**
 * Reindex all siblings under a given parent in a module, setting orderIndex = 0, 1, 2, ...
 */
async function reindexSiblings(moduleId: string, parentId: string | null) {
  const siblings = await prisma.knowledgeItem.findMany({
    where: { moduleId, parentId },
    orderBy: { orderIndex: "asc" },
    select: { id: true, orderIndex: true },
  });
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i].orderIndex !== i) {
      await prisma.knowledgeItem.update({
        where: { id: siblings[i].id },
        data: { orderIndex: i },
      });
    }
  }
}

/**
 * Compute the depth value for a given parentId. Root items have depth 0.
 */
async function computeDepth(parentId: string | null): Promise<number> {
  if (!parentId) return 0;
  const parent = await prisma.knowledgeItem.findUnique({
    where: { id: parentId },
    select: { depth: true },
  });
  return parent ? parent.depth + 1 : 0;
}

/**
 * PATCH /api/items/[itemId]
 *
 * Supports two modes:
 * 1. Legacy: { direction: "up" | "down" } — swap with adjacent sibling
 * 2. New:    { parentId?: string | null, orderIndex?: number } — arbitrary repositioning
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await request.json();

    const item = await prisma.knowledgeItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // --- Legacy direction-based reorder ---
    if ("direction" in body) {
      const { direction } = body as { direction: "up" | "down" };

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
        return NextResponse.json({ success: true, noChange: true });
      }

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
    }

    // --- New: arbitrary repositioning (reparent + reorder) ---
    const { parentId, orderIndex } = body as {
      parentId?: string | null;
      orderIndex?: number;
    };

    const newParentId = parentId !== undefined ? parentId : item.parentId;
    const parentChanged = newParentId !== item.parentId;

    // Validate: parent exists (if non-null)
    if (newParentId !== null) {
      const parent = await prisma.knowledgeItem.findUnique({
        where: { id: newParentId },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent item not found" }, { status: 404 });
      }
      // Parent must be in the same module
      if (parent.moduleId !== item.moduleId) {
        return NextResponse.json(
          { error: "Parent must be in the same module" },
          { status: 400 }
        );
      }
    }

    // Validate: no circular reference (can't make item a child of its own descendant)
    if (parentChanged && newParentId !== null) {
      const descendants = await collectDescendantIdsOf(itemId);
      if (descendants.has(newParentId)) {
        return NextResponse.json(
          { error: "Cannot make an item a child of its own descendant" },
          { status: 400 }
        );
      }
    }

    // Validate: max depth
    if (parentChanged) {
      const newDepth = await computeDepth(newParentId);
      if (newDepth >= MAX_DEPTH) {
        return NextResponse.json(
          { error: `Maximum nesting depth of ${MAX_DEPTH} exceeded` },
          { status: 400 }
        );
      }
      // Also check if any descendants would exceed max depth
      const descendants = await collectDescendantIdsOf(itemId);
      if (descendants.size > 0) {
        // Find max descendant depth relative to this item
        const descItems = await prisma.knowledgeItem.findMany({
          where: { id: { in: [...descendants] } },
          select: { depth: true },
        });
        const maxDescDepth = Math.max(...descItems.map((d) => d.depth));
        const depthIncrease = maxDescDepth - item.depth;
        if (newDepth + depthIncrease >= MAX_DEPTH) {
          return NextResponse.json(
            { error: `Moving this item would cause descendants to exceed max depth of ${MAX_DEPTH}` },
            { status: 400 }
          );
        }
      }
    }

    const oldParentId = item.parentId;

    // Determine target orderIndex
    let targetIndex = orderIndex;
    if (targetIndex === undefined) {
      // If reparenting without explicit index, append at end of new parent
      if (parentChanged) {
        const maxSibling = await prisma.knowledgeItem.findFirst({
          where: { moduleId: item.moduleId, parentId: newParentId },
          orderBy: { orderIndex: "desc" },
          select: { orderIndex: true },
        });
        targetIndex = (maxSibling?.orderIndex ?? -1) + 1;
      } else {
        targetIndex = item.orderIndex; // no change
      }
    }

    // Update the item
    const newDepth = parentChanged ? await computeDepth(newParentId) : item.depth;

    await prisma.knowledgeItem.update({
      where: { id: itemId },
      data: {
        parentId: newParentId,
        orderIndex: targetIndex,
        depth: newDepth,
      },
    });

    // Update depths of descendants if parent changed (single batched walk)
    if (parentChanged) {
      let frontier: string[] = [itemId];
      let depthLevel = newDepth + 1;
      while (frontier.length > 0) {
        const children = await prisma.knowledgeItem.findMany({
          where: { parentId: { in: frontier } },
          select: { id: true },
        });
        if (children.length === 0) break;
        const ids = children.map((c) => c.id);
        await prisma.knowledgeItem.updateMany({
          where: { id: { in: ids } },
          data: { depth: depthLevel },
        });
        frontier = ids;
        depthLevel += 1;
      }
    }

    // Reindex siblings under old parent (if parent changed)
    if (parentChanged) {
      await reindexSiblings(item.moduleId, oldParentId);
    }

    // Reindex siblings under new parent
    // First, make room at the target index by shifting siblings
    const newSiblings = await prisma.knowledgeItem.findMany({
      where: { moduleId: item.moduleId, parentId: newParentId, id: { not: itemId } },
      orderBy: { orderIndex: "asc" },
    });

    // Insert the item at the correct position and reindex
    const reordered = [...newSiblings];
    // Clamp targetIndex
    const clampedIndex = Math.max(0, Math.min(targetIndex!, reordered.length));

    // Assign sequential orderIndex: items before target get 0..clampedIndex-1,
    // our item gets clampedIndex, items after get clampedIndex+1..
    for (let i = 0; i < reordered.length; i++) {
      const newIdx = i < clampedIndex ? i : i + 1;
      if (reordered[i].orderIndex !== newIdx) {
        await prisma.knowledgeItem.update({
          where: { id: reordered[i].id },
          data: { orderIndex: newIdx },
        });
      }
    }
    // Set our item to the clamped index
    await prisma.knowledgeItem.update({
      where: { id: itemId },
      data: { orderIndex: clampedIndex },
    });

    // Return the updated item with parsed content
    const updated = await prisma.knowledgeItem.findUnique({
      where: { id: itemId },
      include: { _count: { select: { comments: true } } },
    });

    if (!updated) {
      return NextResponse.json({ error: "Item not found after update" }, { status: 500 });
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(updated.content);
    } catch {
      parsedContent = updated.content;
    }

    return NextResponse.json({
      id: updated.id,
      moduleId: updated.moduleId,
      parentId: updated.parentId,
      orderIndex: updated.orderIndex,
      title: updated.title,
      difficulty: updated.difficulty,
      content: parsedContent,
      depth: updated.depth,
      commentCount: updated._count.comments,
      children: [],
    });
  } catch (error) {
    console.error("Failed to update item:", error);
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    );
  }
}
