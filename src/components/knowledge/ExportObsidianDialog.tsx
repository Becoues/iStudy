"use client";

import { useState, useCallback } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ExportObsidianDialogProps {
  moduleId: string;
  moduleTopic: string;
  itemId?: string;
  itemTitle?: string;
  trigger: React.ReactNode;
}

export function ExportObsidianDialog({
  moduleId,
  moduleTopic,
  itemId,
  itemTitle,
  trigger,
}: ExportObsidianDialogProps) {
  const [aiPolish, setAiPolish] = useState(false);
  const [includeQuiz, setIncludeQuiz] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [open, setOpen] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/export/obsidian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          itemId,
          aiPolish,
          includeQuiz,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "导出失败");
      }
      setResult({
        success: true,
        message: `已导出到 ${data.filename}`,
      });
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : "导出失败",
      });
    } finally {
      setExporting(false);
    }
  }, [moduleId, itemId, aiPolish, includeQuiz]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setResult(null);
    }
  };

  const exportTarget = itemId
    ? `知识点「${itemTitle}」`
    : `整个模块「${moduleTopic}」`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={trigger as React.ReactElement}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      />
      <DialogPortal>
        <DialogOverlay />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导出到 Obsidian</DialogTitle>
            <DialogDescription>
              将{exportTarget}导出为 Markdown 笔记
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* AI Polish toggle */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aiPolish}
                onChange={(e) => setAiPolish(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">AI 润色</span>
                <span className="text-xs text-muted-foreground">
                  使用 gemini-3.1-flash-lite-preview 将笔记润色为流畅自然的学习笔记
                </span>
              </div>
            </label>

            {/* Include Quiz toggle */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeQuiz}
                onChange={(e) => setIncludeQuiz(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">携带测验题</span>
                <span className="text-xs text-muted-foreground">
                  在笔记末尾包含每个知识点的选择题和答案解析
                </span>
              </div>
            </label>

            {/* Result message */}
            {result && (
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  result.success
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {result.success ? (
                  <Check className="size-4 shrink-0" />
                ) : (
                  <AlertCircle className="size-4 shrink-0" />
                )}
                {result.message}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  {result?.success ? "关闭" : "取消"}
                </Button>
              }
            />
            {!result?.success && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport();
                }}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {aiPolish ? "润色导出中..." : "导出中..."}
                  </>
                ) : (
                  "导出"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
