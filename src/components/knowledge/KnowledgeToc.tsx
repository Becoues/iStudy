"use client";

import { ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { KnowledgeItemWithChildren } from "@/types/knowledge";

interface KnowledgeTocProps {
  items: KnowledgeItemWithChildren[];
  selectedItemId: string | null;
  onSelectItem: (item: KnowledgeItemWithChildren) => void;
}

function TocItem({
  item,
  depth,
  selectedItemId,
  onSelectItem,
}: {
  item: KnowledgeItemWithChildren;
  depth: number;
  selectedItemId: string | null;
  onSelectItem: (item: KnowledgeItemWithChildren) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;
  const isSelected = selectedItemId === item.id;

  return (
    <div>
      <button
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
          // Scroll to item
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
      {hasChildren && expanded && (
        <div>
          {item.children.map((child) => (
            <TocItem
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedItemId={selectedItemId}
              onSelectItem={onSelectItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function KnowledgeToc({ items, selectedItemId, onSelectItem }: KnowledgeTocProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <TocItem
          key={item.id}
          item={item}
          depth={0}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
        />
      ))}
    </div>
  );
}
