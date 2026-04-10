"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddNodeDialog } from "@/components/knowledge/AddNodeDialog";
import type { KnowledgeItemWithChildren } from "@/types/knowledge";

interface AddNodeButtonProps {
  moduleId: string;
  parentId: string | null;
  orderIndex: number;
  onItemCreated: (item: KnowledgeItemWithChildren) => void;
}

export function AddNodeButton({
  moduleId,
  parentId,
  orderIndex,
  onItemCreated,
}: AddNodeButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="group/add flex items-center justify-center py-0.5">
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded-full border border-dashed border-transparent px-2 py-0.5",
            "text-xs text-muted-foreground/0 transition-all duration-200",
            "group-hover/add:border-border group-hover/add:text-muted-foreground",
            "hover:!border-primary/50 hover:!text-primary hover:bg-primary/5"
          )}
          onClick={() => setDialogOpen(true)}
          aria-label="添加节点"
        >
          <Plus className="size-3" />
          <span>添加</span>
        </button>
      </div>
      <AddNodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        moduleId={moduleId}
        parentId={parentId}
        orderIndex={orderIndex}
        onItemCreated={onItemCreated}
      />
    </>
  );
}
