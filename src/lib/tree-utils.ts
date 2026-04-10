import { KnowledgeItemWithChildren } from "@/types/knowledge";

/**
 * Insert a new item into the tree without full refetch.
 * If parentId is null, inserts at root level.
 * The item is inserted at its orderIndex position (or appended if out of range).
 */
export function insertItemIntoTree(
  items: KnowledgeItemWithChildren[],
  newItem: KnowledgeItemWithChildren,
  parentId: string | null
): KnowledgeItemWithChildren[] {
  if (parentId === null) {
    // Insert at root level at the correct position
    const result = [...items];
    const insertIdx = Math.min(newItem.orderIndex, result.length);
    result.splice(insertIdx, 0, newItem);
    return reindexSiblings(result);
  }

  // Recursively find parent and insert into its children
  return items.map((item) => {
    if (item.id === parentId) {
      const newChildren = [...item.children];
      const insertIdx = Math.min(newItem.orderIndex, newChildren.length);
      newChildren.splice(insertIdx, 0, newItem);
      return { ...item, children: reindexSiblings(newChildren) };
    }
    if (item.children.length > 0) {
      const updatedChildren = insertItemIntoTree(item.children, newItem, parentId);
      if (updatedChildren !== item.children) {
        return { ...item, children: updatedChildren };
      }
    }
    return item;
  });
}

/**
 * Move an item to a new position (reparent + reorder).
 * Removes the item from its current position and inserts it under newParentId at newIndex.
 */
export function moveItemInTree(
  items: KnowledgeItemWithChildren[],
  itemId: string,
  newParentId: string | null,
  newIndex: number
): KnowledgeItemWithChildren[] {
  // Step 1: Extract the item from the tree
  const extractedHolder: { value: KnowledgeItemWithChildren | null } = { value: null };
  const withoutItem = removeItemFromTreeInternal(items, itemId, (found) => {
    extractedHolder.value = found;
  });

  if (!extractedHolder.value) return items; // item not found, return unchanged

  // Step 2: Update the item's parentId and orderIndex
  const movedItem: KnowledgeItemWithChildren = {
    ...extractedHolder.value,
    parentId: newParentId,
    orderIndex: newIndex,
  };

  // Step 3: Insert at new position
  return insertItemIntoTree(withoutItem, movedItem, newParentId);
}

/**
 * Remove an item (and its subtree) from the tree.
 * Returns a new tree without the item. Siblings are reindexed.
 */
export function removeItemFromTree(
  items: KnowledgeItemWithChildren[],
  itemId: string
): KnowledgeItemWithChildren[] {
  return removeItemFromTreeInternal(items, itemId);
}

/**
 * Internal removal that optionally captures the removed item via callback.
 */
function removeItemFromTreeInternal(
  items: KnowledgeItemWithChildren[],
  itemId: string,
  onFound?: (item: KnowledgeItemWithChildren) => void
): KnowledgeItemWithChildren[] {
  let found = false;
  const result: KnowledgeItemWithChildren[] = [];

  for (const item of items) {
    if (item.id === itemId) {
      found = true;
      onFound?.(item);
      continue; // skip this item
    }

    if (item.children.length > 0) {
      const updatedChildren = removeItemFromTreeInternal(item.children, itemId, onFound);
      if (updatedChildren.length !== item.children.length) {
        // Item was found in this subtree; reindex children
        result.push({ ...item, children: reindexSiblings(updatedChildren) });
        continue;
      }
      // Check if children were modified (deeper removal)
      if (updatedChildren !== item.children) {
        result.push({ ...item, children: updatedChildren });
        continue;
      }
    }

    result.push(item);
  }

  // Reindex at this level if we removed something here
  return found ? reindexSiblings(result) : result;
}

/**
 * Recompute orderIndex for all items in an array: 0, 1, 2, ...
 * Returns a new array with updated orderIndex values.
 */
export function reindexSiblings(
  items: KnowledgeItemWithChildren[]
): KnowledgeItemWithChildren[] {
  let needsUpdate = false;
  for (let i = 0; i < items.length; i++) {
    if (items[i].orderIndex !== i) {
      needsUpdate = true;
      break;
    }
  }
  if (!needsUpdate) return items;

  return items.map((item, i) =>
    item.orderIndex === i ? item : { ...item, orderIndex: i }
  );
}
