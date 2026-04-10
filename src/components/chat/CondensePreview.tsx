"use client";

import { useState, useCallback, useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSingleItem } from "@/lib/api-helpers";
import type {
  KnowledgeItemData,
  KnowledgeItemWithChildren,
} from "@/types/knowledge";

interface CondensePreviewProps {
  open: boolean;
  onClose: () => void;
  data: KnowledgeItemData;
  moduleId: string;
  items: KnowledgeItemWithChildren[];
  onItemCreated: (item: KnowledgeItemWithChildren) => void;
}

/** Flatten items into a list of {id, title, depth} for the parent selector */
function flattenItems(
  items: KnowledgeItemWithChildren[]
): Array<{ id: string; title: string; depth: number }> {
  const result: Array<{ id: string; title: string; depth: number }> = [];
  for (const item of items) {
    result.push({ id: item.id, title: item.content.title, depth: item.depth });
    result.push(...flattenItems(item.children));
  }
  return result;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  basic: "基础",
  intermediate: "中级",
  advanced: "高级",
};

export function CondensePreview({
  open,
  onClose,
  data,
  moduleId,
  items,
  onItemCreated,
}: CondensePreviewProps) {
  const [parentId, setParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatItems = useMemo(() => flattenItems(items), [items]);

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await createSingleItem(moduleId, {
        title: data.title,
        content: data,
        parentId,
        difficulty: data.difficulty,
      });
      onItemCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [moduleId, data, parentId, onItemCreated, onClose]);

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>凝练为知识卡片</DialogTitle>
          <DialogDescription>
            预览 AI 从对话中提取的知识卡片，选择插入位置后确认
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* Title */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">标题</p>
            <p className="text-sm font-medium">{data.title}</p>
          </div>

          {/* Difficulty */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">难度</p>
            <Badge variant="secondary" className="text-xs">
              {DIFFICULTY_LABELS[data.difficulty] || data.difficulty}
            </Badge>
          </div>

          {/* Summary */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">摘要</p>
            <p className="text-sm text-foreground/80">{data.summary}</p>
          </div>

          {/* Details preview */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">详情预览</p>
            <p className="max-h-32 overflow-y-auto text-xs text-foreground/70 rounded-md bg-muted/40 p-2 leading-relaxed">
              {data.details.length > 300
                ? data.details.slice(0, 300) + "..."
                : data.details}
            </p>
          </div>

          {/* Parent selector */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">插入位置</p>
            <Select
              value={parentId ?? "__root__"}
              onValueChange={(val) =>
                setParentId(val === "__root__" ? null : (val as string))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">根节点</SelectItem>
                {flatItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <span style={{ paddingLeft: `${item.depth * 12}px` }}>
                      {item.title}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            确认添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
