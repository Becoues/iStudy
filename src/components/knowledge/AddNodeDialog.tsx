"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createSingleItem } from "@/lib/api-helpers";
import type { KnowledgeItemWithChildren } from "@/types/knowledge";

interface AddNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  parentId: string | null;
  orderIndex: number;
  onItemCreated: (item: KnowledgeItemWithChildren) => void;
}

const DIFFICULTY_OPTIONS = [
  { value: "basic", label: "基础" },
  { value: "intermediate", label: "中级" },
  { value: "advanced", label: "高级" },
] as const;

export function AddNodeDialog({
  open,
  onOpenChange,
  moduleId,
  parentId,
  orderIndex,
  onItemCreated,
}: AddNodeDialogProps) {
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<string>("basic");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setDifficulty("basic");
    setSummary("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setSubmitting(true);
    setError(null);

    try {
      const item = await createSingleItem(moduleId, {
        title: trimmedTitle,
        content: {
          title: trimmedTitle,
          difficulty,
          summary: summary.trim() || `关于${trimmedTitle}的知识点`,
          details: "",
          mermaid: null,
          quiz: { question: "", options: [], hint: "", answer: "", explanation: "" },
        },
        parentId,
        orderIndex,
        difficulty,
      });

      onItemCreated(item);
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加知识节点</DialogTitle>
          <DialogDescription>
            创建一个新的知识节点，稍后可以用 AI 展开详情。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-node-title" className="text-sm font-medium">
              标题 <span className="text-destructive">*</span>
            </label>
            <Input
              id="add-node-title"
              placeholder="输入知识点标题..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Difficulty */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">难度</label>
            <Select value={difficulty} onValueChange={(v) => { if (v) setDifficulty(v); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-node-summary" className="text-sm font-medium">
              摘要 <span className="text-muted-foreground text-xs">（可选）</span>
            </label>
            <Textarea
              id="add-node-summary"
              placeholder="简要描述这个知识点..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  创建中...
                </>
              ) : (
                "创建"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
