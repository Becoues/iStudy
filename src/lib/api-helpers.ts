import { KnowledgeItemWithChildren } from "@/types/knowledge";

/**
 * Move/reorder an item by calling PATCH /api/items/[itemId].
 * Returns the updated item with parsed content.
 */
export async function reorderItem(
  itemId: string,
  parentId: string | null,
  orderIndex: number
): Promise<KnowledgeItemWithChildren> {
  const res = await fetch(`/api/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentId, orderIndex }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Failed to reorder item (${res.status})`);
  }

  return res.json();
}

/**
 * Create a single knowledge item under a module.
 * Returns the full created item object (with id, children: []).
 */
export async function createSingleItem(
  moduleId: string,
  item: {
    title: string;
    content: object;
    parentId: string | null;
    orderIndex?: number;
    difficulty?: string;
  }
): Promise<KnowledgeItemWithChildren> {
  const res = await fetch(`/api/modules/${moduleId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Failed to create item (${res.status})`);
  }

  return res.json();
}
