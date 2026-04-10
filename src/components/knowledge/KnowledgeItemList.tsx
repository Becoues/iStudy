"use client";

import { KnowledgeItemCard } from "@/components/knowledge/KnowledgeItemCard";
import { AddNodeButton } from "@/components/knowledge/AddNodeButton";
import type { KnowledgeItemWithChildren } from "@/types/knowledge";

interface KnowledgeItemListProps {
  items: KnowledgeItemWithChildren[];
  moduleId: string;
  moduleTopic?: string;
  favorites: string[];
  selectedItemId: string | null;
  onToggleFavorite: (itemId: string, title: string) => void;
  onSelectItem: (item: KnowledgeItemWithChildren) => void;
  onExpandItem: (item: KnowledgeItemWithChildren) => void;
  onCommentItem?: (item: KnowledgeItemWithChildren) => void;
  expandingItemId?: string | null;
  onItemCreated?: (item: KnowledgeItemWithChildren) => void;
}

export function KnowledgeItemList({
  items,
  moduleId,
  moduleTopic,
  favorites,
  selectedItemId,
  onToggleFavorite,
  onSelectItem,
  onExpandItem,
  onCommentItem,
  expandingItemId = null,
  onItemCreated,
}: KnowledgeItemListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">暂无知识内容</p>
        {onItemCreated && (
          <div className="mt-4">
            <AddNodeButton
              moduleId={moduleId}
              parentId={null}
              orderIndex={0}
              onItemCreated={onItemCreated}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Add button at the top of the list (root level, orderIndex=0) */}
      {onItemCreated && (
        <AddNodeButton
          moduleId={moduleId}
          parentId={null}
          orderIndex={0}
          onItemCreated={onItemCreated}
        />
      )}

      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-4">
          <KnowledgeItemCard
            item={item}
            moduleId={moduleId}
            moduleTopic={moduleTopic}
            isFavorite={favorites.includes(item.id)}
            isSelected={selectedItemId === item.id}
            onToggleFavorite={onToggleFavorite}
            onSelect={onSelectItem}
            onExpand={onExpandItem}
            onComment={onCommentItem}
            isExpanding={expandingItemId === item.id}
            favorites={favorites}
            selectedItemId={selectedItemId}
            onItemCreated={onItemCreated}
          />

          {/* Add button after each root item (sibling, orderIndex = item.orderIndex + 1) */}
          {onItemCreated && (
            <AddNodeButton
              moduleId={moduleId}
              parentId={item.parentId}
              orderIndex={item.orderIndex + 1}
              onItemCreated={onItemCreated}
            />
          )}
        </div>
      ))}
    </div>
  );
}
