"use client";

import { KnowledgeItemCard } from "@/components/knowledge/KnowledgeItemCard";
import type { KnowledgeItemWithChildren } from "@/types/knowledge";

interface KnowledgeItemListProps {
  items: KnowledgeItemWithChildren[];
  moduleId: string;
  favorites: string[];
  selectedItemId: string | null;
  onToggleFavorite: (itemId: string, title: string) => void;
  onSelectItem: (item: KnowledgeItemWithChildren) => void;
  onExpandItem: (item: KnowledgeItemWithChildren) => void;
  onCommentItem?: (item: KnowledgeItemWithChildren) => void;
  expandingItemId?: string | null;
}

export function KnowledgeItemList({
  items,
  moduleId,
  favorites,
  selectedItemId,
  onToggleFavorite,
  onSelectItem,
  onExpandItem,
  onCommentItem,
  expandingItemId = null,
}: KnowledgeItemListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">暂无知识内容</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <KnowledgeItemCard
          key={item.id}
          item={item}
          moduleId={moduleId}
          isFavorite={favorites.includes(item.id)}
          isSelected={selectedItemId === item.id}
          onToggleFavorite={onToggleFavorite}
          onSelect={onSelectItem}
          onExpand={onExpandItem}
          onComment={onCommentItem}
          isExpanding={expandingItemId === item.id}
          favorites={favorites}
          selectedItemId={selectedItemId}
        />
      ))}
    </div>
  );
}
