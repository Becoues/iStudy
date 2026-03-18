"use client";

import { ChevronRight, ChevronDown, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { KnowledgeItemWithChildren } from "@/types/knowledge";

interface KnowledgeTocProps {
  items: KnowledgeItemWithChildren[];
  selectedItemId: string | null;
  onSelectItem: (item: KnowledgeItemWithChildren) => void;
  onDeleteItem?: (itemId: string) => void;
  onMoveItem?: (itemId: string, direction: "up" | "down") => void;
}

function TocItem({
  item,
  depth,
  selectedItemId,
  onSelectItem,
  onDeleteItem,
  onMoveItem,
  isFirst,
  isLast,
}: {
  item: KnowledgeItemWithChildren;
  depth: number;
  selectedItemId: string | null;
  onSelectItem: (item: KnowledgeItemWithChildren) => void;
  onDeleteItem?: (itemId: string) => void;
  onMoveItem?: (itemId: string, direction: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;
  const isSelected = selectedItemId === item.id;
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll TOC sidebar to keep active item visible
  useEffect(() => {
    if (isSelected && buttonRef.current) {
      buttonRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isSelected]);

  return (
    <div>
      <div className="group relative">
        <button
          ref={buttonRef}
          type="button"
          className={cn(
            "flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
            isSelected
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            onSelectItem(item);
            const el = document.getElementById(`knowledge-item-${item.id}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        {/* Action buttons — float over text on hover */}
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
              onDeleteItem={onDeleteItem}
              onMoveItem={onMoveItem}
              isFirst={idx === 0}
              isLast={idx === item.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function KnowledgeToc({
  items,
  selectedItemId,
  onSelectItem,
  onDeleteItem,
  onMoveItem,
}: KnowledgeTocProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item, idx) => (
        <TocItem
          key={item.id}
          item={item}
          depth={0}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          onDeleteItem={onDeleteItem}
          onMoveItem={onMoveItem}
          isFirst={idx === 0}
          isLast={idx === items.length - 1}
        />
      ))}
    </div>
  );
}
