"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Layers,
  MessageCircleQuestion,
  ImageIcon,
  X,
  RotateCcw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTaskQueue } from "@/hooks/useTaskQueue";
import type { TaskItem } from "@/lib/task-store";

const TYPE_ICONS: Record<TaskItem["type"], React.ReactNode> = {
  generate: <Sparkles className="size-3.5" />,
  expand: <Layers className="size-3.5" />,
  followup: <MessageCircleQuestion className="size-3.5" />,
  image: <ImageIcon className="size-3.5" />,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function ElapsedTime({ startedAt }: { startedAt: number | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {mins > 0 ? `${mins}m ` : ""}{secs}s
    </span>
  );
}

function StatusBadge({ status }: { status: TaskItem["status"] }) {
  switch (status) {
    case "queued":
      return (
        <Badge variant="secondary">
          <Clock className="size-3 mr-0.5" />
          排队中
        </Badge>
      );
    case "running":
      return (
        <Badge variant="default">
          <Loader2 className="size-3 mr-0.5 animate-spin" />
          运行中
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline">
          <CheckCircle2 className="size-3 mr-0.5 text-green-600" />
          完成
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="size-3 mr-0.5" />
          失败
        </Badge>
      );
  }
}

interface TaskQueuePanelProps {
  open: boolean;
  onClose: () => void;
}

export function TaskQueuePanel({ open, onClose }: TaskQueuePanelProps) {
  const { tasks, cancel, retry, clearCompleted, runningCount, queuedCount } =
    useTaskQueue();

  if (!open) return null;

  const hasFinished = tasks.some(
    (t) => t.status === "completed" || t.status === "failed"
  );

  return (
    <Card className="w-[340px] shadow-2xl">
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            任务队列
            {(runningCount > 0 || queuedCount > 0) && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                {runningCount} 运行中 / {queuedCount} 排队
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {hasFinished && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={clearCompleted}
                title="清除已完成"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon-xs" onClick={onClose}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            暂无任务
          </p>
        ) : (
          <ScrollArea className="max-h-[320px]">
            <div className="flex flex-col divide-y">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-2.5 px-4 py-2.5"
                >
                  {/* Type icon */}
                  <div className="mt-0.5 shrink-0 text-muted-foreground">
                    {TYPE_ICONS[task.type]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-medium truncate">
                        {task.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={task.status} />
                      {task.status === "running" && (
                        <>
                          <ElapsedTime startedAt={task.startedAt} />
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(task.bytesReceived)}
                          </span>
                        </>
                      )}
                      {task.status === "failed" && task.error && (
                        <span className="text-xs text-destructive truncate max-w-[140px]" title={task.error}>
                          {task.error}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-0.5">
                    {(task.status === "running" || task.status === "queued") && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => cancel(task.id)}
                        title="取消"
                      >
                        <X className="size-3" />
                      </Button>
                    )}
                    {task.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => retry(task.id)}
                        title="重试"
                      >
                        <RotateCcw className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
