"use client";

import {
  ChevronRight,
  ChevronDown,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { scrollElementIntoContainer } from "@/lib/scroll-utils";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  attachInstruction,
  extractInstruction,
  type Instruction,
  type ItemMode,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { reorderItem } from "@/lib/api-helpers";
import type { KnowledgeItemWithChildren } from "@/types/knowledge";

const INDENT_PER_LEVEL = 16;
const MAX_DEPTH = 3;

interface KnowledgeTocProps {
  items: KnowledgeItemWithChildren[];
  selectedItemId: string | null;
  onSelectItem: (item: KnowledgeItemWithChildren) => void;
  onScrollToItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onMoveItem?: (itemId: string, direction: "up" | "down") => void;
  onItemMoved?: (itemId: string, newParentId: string | null, newIndex: number) => void;
}

/** Compute depth of an item in the tree by counting how many levels deep it is */
function getItemDepth(items: KnowledgeItemWithChildren[], targetId: string, currentDepth = 0): number {
  for (const item of items) {
    if (item.id === targetId) return currentDepth;
    if (item.children.length > 0) {
      const found = getItemDepth(item.children, targetId, currentDepth + 1);
      if (found >= 0) return found;
    }
  }
  return -1;
}

/** Get the maximum depth of a subtree (from the item itself, counting 0 as root) */
function getSubtreeMaxDepth(item: KnowledgeItemWithChildren): number {
  if (item.children.length === 0) return 0;
  return 1 + Math.max(...item.children.map(getSubtreeMaxDepth));
}

type DragState = "idle" | "dragging" | "over";

interface InstructionState {
  instruction: Instruction | null;
}

function TocItem({
  item,
  depth,
  selectedItemId,
  onSelectItem,
  onScrollToItem,
  onDeleteItem,
  onMoveItem,
  isFirst,
  isLast,
  allItems,
}: {
  item: KnowledgeItemWithChildren;
  depth: number;
  selectedItemId: string | null;
  onSelectItem: (item: KnowledgeItemWithChildren) => void;
  onScrollToItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onMoveItem?: (itemId: string, direction: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
  allItems: KnowledgeItemWithChildren[];
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;
  const isSelected = selectedItemId === item.id;
  const itemRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragHandleRef = useRef<HTMLButtonElement>(null);

  const [dragState, setDragState] = useState<DragState>("idle");
  const [instructionState, setInstructionState] = useState<InstructionState>({
    instruction: null,
  });

  // Auto-scroll TOC sidebar to keep active item visible
  useEffect(() => {
    if (isSelected && buttonRef.current) {
      const scrollContainer = buttonRef.current.closest<HTMLElement>(
        "[data-toc-scroll-container]"
      );
      if (scrollContainer) {
        scrollElementIntoContainer(scrollContainer, buttonRef.current, {
          behavior: "smooth",
          block: "nearest",
          padding: 8,
        });
      }
    }
  }, [isSelected]);

  // Register draggable + drop target
  useEffect(() => {
    const element = itemRef.current;
    const dragHandle = dragHandleRef.current;
    if (!element || !dragHandle) return;

    const mode: ItemMode = hasChildren && expanded
      ? "expanded"
      : isLast
        ? "last-in-group"
        : "standard";

    // Determine which instructions to block
    const blocked: Instruction["type"][] = [];
    // Block make-child if it would exceed max depth
    const subtreeDepth = getSubtreeMaxDepth(item);
    if (depth + 1 + subtreeDepth >= MAX_DEPTH) {
      // Cannot become a child if it would exceed max depth
      // (but we'll apply this on the drop target side)
    }

    return combine(
      draggable({
        element,
        dragHandle,
        getInitialData() {
          return {
            id: item.id,
            parentId: item.parentId,
            orderIndex: item.orderIndex,
            depth,
            type: "toc-item",
          };
        },
        onDragStart() {
          setDragState("dragging");
        },
        onDrop() {
          setDragState("idle");
        },
      }),
      dropTargetForElements({
        element,
        canDrop({ source }) {
          // Only accept toc-item drags, and not dropping on self
          return source.data.type === "toc-item" && source.data.id !== item.id;
        },
        getData({ input, element: el }) {
          const sourceData = {} as Record<string, unknown>;
          return attachInstruction(sourceData, {
            element: el,
            input,
            currentLevel: depth,
            indentPerLevel: INDENT_PER_LEVEL,
            mode,
            block: blocked,
          });
        },
        onDrag({ self }) {
          const instruction = extractInstruction(self.data);
          setDragState("over");
          setInstructionState({ instruction });
        },
        onDragLeave() {
          setDragState("idle");
          setInstructionState({ instruction: null });
        },
        onDrop() {
          setDragState("idle");
          setInstructionState({ instruction: null });
        },
      })
    );
  }, [item, depth, isLast, hasChildren, expanded]);

  // Compute drop indicator styles based on instruction
  const dropIndicator = instructionState.instruction;
  let indicatorElement: React.ReactNode = null;

  if (dragState === "over" && dropIndicator) {
    const type = dropIndicator.type;
    if (type === "reorder-above") {
      indicatorElement = (
        <div
          className="absolute left-0 right-0 top-0 h-0.5 bg-primary rounded-full pointer-events-none z-20"
          style={{ marginLeft: `${depth * INDENT_PER_LEVEL}px` }}
        />
      );
    } else if (type === "reorder-below") {
      indicatorElement = (
        <div
          className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary rounded-full pointer-events-none z-20"
          style={{ marginLeft: `${depth * INDENT_PER_LEVEL}px` }}
        />
      );
    } else if (type === "make-child") {
      indicatorElement = (
        <div
          className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary rounded-full pointer-events-none z-20"
          style={{ marginLeft: `${(depth + 1) * INDENT_PER_LEVEL}px` }}
        />
      );
    } else if (type === "reparent") {
      const desiredLevel = dropIndicator.desiredLevel;
      indicatorElement = (
        <div
          className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary rounded-full pointer-events-none z-20"
          style={{ marginLeft: `${desiredLevel * INDENT_PER_LEVEL}px` }}
        />
      );
    }
  }

  return (
    <div>
      <div
        ref={itemRef}
        className={cn(
          "group relative",
          dragState === "dragging" && "opacity-40"
        )}
      >
        {indicatorElement}
        <div className="flex items-center">
          {/* Drag handle */}
          <button
            ref={dragHandleRef}
            type="button"
            className="shrink-0 p-0.5 cursor-grab opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground"
            style={{ marginLeft: `${Math.max(0, depth * INDENT_PER_LEVEL - 4)}px` }}
            tabIndex={-1}
            aria-label="拖拽排序"
          >
            <GripVertical className="size-3" />
          </button>
          <button
            ref={buttonRef}
            type="button"
            className={cn(
              "flex flex-1 items-center gap-1 rounded-md px-1 py-1.5 text-left text-sm transition-colors min-w-0",
              isSelected
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              dragState === "over" && dropIndicator?.type === "make-child" && "bg-primary/5"
            )}
            onClick={() => {
              onSelectItem(item);
              onScrollToItem?.(item.id);
            }}
          >
            {hasChildren ? (
              <span
                className="shrink-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
              >
                {expanded ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </span>
            ) : (
              <span className="size-3.5 shrink-0" />
            )}
            <span className="truncate">{item.content.title}</span>
          </button>
        </div>
        {/* Action buttons -- float over text on hover */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-md bg-background/90 backdrop-blur-sm shadow-sm border px-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {!isFirst && onMoveItem && (
            <button
              type="button"
              className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              title="上移"
              onClick={(e) => {
                e.stopPropagation();
                onMoveItem(item.id, "up");
              }}
            >
              <ArrowUp className="size-3" />
            </button>
          )}
          {!isLast && onMoveItem && (
            <button
              type="button"
              className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              title="下移"
              onClick={(e) => {
                e.stopPropagation();
                onMoveItem(item.id, "down");
              }}
            >
              <ArrowDown className="size-3" />
            </button>
          )}
          {onDeleteItem && (
            <button
              type="button"
              className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              title="删除"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteItem(item.id);
              }}
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>
      {hasChildren && expanded && (
        <div>
          {item.children.map((child, idx) => (
            <TocItem
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedItemId={selectedItemId}
              onSelectItem={onSelectItem}
              onScrollToItem={onScrollToItem}
              onDeleteItem={onDeleteItem}
              onMoveItem={onMoveItem}
              isFirst={idx === 0}
              isLast={idx === item.children.length - 1}
              allItems={allItems}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Resolve the instruction from a drop into concrete parentId + orderIndex.
 * Returns null if the operation is invalid (e.g. would exceed max depth).
 */
function resolveDropInstruction(
  instruction: Instruction,
  allItems: KnowledgeItemWithChildren[],
  sourceId: string,
  targetItem: { id: string; parentId: string | null; orderIndex: number; depth: number }
): { parentId: string | null; orderIndex: number } | null {
  switch (instruction.type) {
    case "reorder-above": {
      // Insert before the target item at the same level
      return {
        parentId: targetItem.parentId,
        orderIndex: targetItem.orderIndex,
      };
    }
    case "reorder-below": {
      // Insert after the target item at the same level
      return {
        parentId: targetItem.parentId,
        orderIndex: targetItem.orderIndex + 1,
      };
    }
    case "make-child": {
      // Make the dragged item a child of the target
      // Find the target item to know how many children it has
      const target = findItemById(allItems, targetItem.id);
      if (!target) return null;
      // Check depth constraint
      const sourceItem = findItemById(allItems, sourceId);
      if (!sourceItem) return null;
      const subtreeDepth = getSubtreeMaxDepth(sourceItem);
      if (targetItem.depth + 1 + subtreeDepth >= MAX_DEPTH) return null;
      return {
        parentId: targetItem.id,
        orderIndex: target.children.length, // append at end
      };
    }
    case "reparent": {
      // Move to a different level based on desiredLevel
      const desiredLevel = instruction.desiredLevel;
      // Walk up from the target to find the ancestor at the desired level
      let ancestorId: string | null = targetItem.parentId;
      let currentLevel = targetItem.depth;

      while (currentLevel > desiredLevel && ancestorId !== null) {
        const parent = findItemById(allItems, ancestorId);
        if (!parent) break;
        ancestorId = parent.parentId;
        currentLevel--;
      }

      if (currentLevel === desiredLevel) {
        // Insert after the ancestor that contains the target
        const siblings = ancestorId === null
          ? allItems
          : findItemById(allItems, ancestorId)?.children ?? [];
        // Find the index of the item that is the ancestor of the target at this level
        const ancestorAtLevel = findAncestorAtLevel(allItems, targetItem.id, desiredLevel);
        if (ancestorAtLevel) {
          const idx = siblings.findIndex((s) => s.id === ancestorAtLevel.id);
          return {
            parentId: ancestorId,
            orderIndex: idx + 1,
          };
        }
      }

      return {
        parentId: ancestorId,
        orderIndex: 0,
      };
    }
    case "instruction-blocked":
      return null;
    default:
      return null;
  }
}

function findItemById(
  items: KnowledgeItemWithChildren[],
  id: string
): KnowledgeItemWithChildren | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children.length > 0) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findAncestorAtLevel(
  items: KnowledgeItemWithChildren[],
  targetId: string,
  level: number,
  currentLevel = 0
): KnowledgeItemWithChildren | null {
  for (const item of items) {
    if (item.id === targetId && currentLevel === level) return item;
    if (item.children.length > 0) {
      const found = findAncestorAtLevel(item.children, targetId, level, currentLevel + 1);
      if (found) {
        // If we're at the desired level and the target is in our subtree, return ourselves
        if (currentLevel === level) return item;
        return found;
      }
    }
  }
  return null;
}

export function KnowledgeToc({
  items,
  selectedItemId,
  onSelectItem,
  onScrollToItem,
  onDeleteItem,
  onMoveItem,
  onItemMoved,
}: KnowledgeTocProps) {
  const tocRef = useRef<HTMLDivElement>(null);

  // Monitor for all drops within the TOC
  useEffect(() => {
    if (!onItemMoved) return;

    return monitorForElements({
      canMonitor({ source }) {
        return source.data.type === "toc-item";
      },
      onDrop({ source, location }) {
        const dropTargets = location.current.dropTargets;
        if (dropTargets.length === 0) return;

        const target = dropTargets[0];
        const instruction = extractInstruction(target.data);
        if (!instruction) return;

        const sourceId = source.data.id as string;
        const targetData = {
          id: target.data.id as string ?? "",
          parentId: (target.data.parentId as string | null) ?? null,
          orderIndex: (target.data.orderIndex as number) ?? 0,
          depth: (target.data.depth as number) ?? 0,
        };

        // The drop target data doesn't have all fields since we use attachInstruction.
        // We need to look up target info from the tree.
        const targetItem = findItemById(items, targetData.id);
        if (!targetItem) {
          // Fallback: try to extract from the drop target element
          return;
        }

        const targetDepth = getItemDepth(items, targetItem.id);
        const resolvedTarget = {
          id: targetItem.id,
          parentId: targetItem.parentId,
          orderIndex: targetItem.orderIndex,
          depth: targetDepth >= 0 ? targetDepth : 0,
        };

        const result = resolveDropInstruction(instruction, items, sourceId, resolvedTarget);
        if (!result) return;

        // Call the API and the callback
        onItemMoved(sourceId, result.parentId, result.orderIndex);

        // Fire-and-forget API call
        reorderItem(sourceId, result.parentId, result.orderIndex).catch((err) => {
          console.error("Failed to reorder item:", err);
        });
      },
    });
  }, [items, onItemMoved]);

  return (
    <div ref={tocRef} className="flex flex-col gap-0.5">
      {items.map((item, idx) => (
        <TocItem
          key={item.id}
          item={item}
          depth={0}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          onScrollToItem={onScrollToItem}
          onDeleteItem={onDeleteItem}
          onMoveItem={onMoveItem}
          isFirst={idx === 0}
          isLast={idx === items.length - 1}
          allItems={items}
        />
      ))}
    </div>
  );
}
