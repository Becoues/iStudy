"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  BookOpen,
  ArrowRight,
  Loader2,
  Trash2,
  Hash,
  Calendar,
  X,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTaskQueue } from "@/hooks/useTaskQueue";
import { useTaskStore } from "@/lib/task-store";
import { parseGenerationResponse } from "@/lib/parseKnowledge";
import { TaskQueueFab } from "@/components/task/TaskQueueFab";
import type { ModuleListItem } from "@/types/knowledge";
import type { TaskItem } from "@/lib/task-store";

const MAX_PARALLEL = 3;

interface DisambiguateOption {
  label: string;
  description: string;
  domain: string;
}

interface SaveState {
  status: "saving" | "saved" | "save-failed";
  error?: string;
  moduleId?: string;
}

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [modules, setModules] = useState<ModuleListItem[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Disambiguation dialog state
  const [pendingTopic, setPendingTopic] = useState<string | null>(null);
  const [disambigOptions, setDisambigOptions] = useState<
    DisambiguateOption[] | null
  >(null);

  // Per-task save state for in-flight generation tasks
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const handlingSaveRef = useRef<Set<string>>(new Set());

  const { tasks, enqueue, cancel, retry } = useTaskQueue();

  const generateTasks = tasks.filter((t) => t.type === "generate");

  // Count tasks that occupy a "slot": queued/running, plus completed-but-still-saving
  const activeSlotCount = generateTasks.filter((t) => {
    if (t.status === "queued" || t.status === "running") return true;
    if (t.status === "completed" && saveState[t.id]?.status === "saving") return true;
    return false;
  }).length;

  const atLimit = activeSlotCount >= MAX_PARALLEL;

  // Cards to render: any generate task except those already saved (which moved to module list)
  const visibleGenerateTasks = generateTasks.filter(
    (t) => saveState[t.id]?.status !== "saved"
  );

  // Fetch recent modules on mount
  useEffect(() => {
    refreshModules();
  }, []);

  async function refreshModules() {
    try {
      const res = await fetch("/api/modules?sort=desc");
      if (!res.ok) throw new Error("获取模块列表失败");
      const data: ModuleListItem[] = await res.json();
      setModules(data.slice(0, 6));
      setModulesError(null);
    } catch (err) {
      setModulesError(err instanceof Error ? err.message : "获取模块列表失败");
    } finally {
      setModulesLoading(false);
    }
  }

  // Watch for newly-completed generate tasks; persist each one independently.
  useEffect(() => {
    for (const task of generateTasks) {
      if (
        task.status === "completed" &&
        task.result &&
        !handlingSaveRef.current.has(task.id) &&
        !saveState[task.id]
      ) {
        handlingSaveRef.current.add(task.id);
        void handleSave(task);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  async function handleSave(task: TaskItem) {
    setSaveState((prev) => ({
      ...prev,
      [task.id]: { status: "saving" },
    }));

    try {
      const parsed = parseGenerationResponse(task.result || "");
      const items = parsed.items.map((item, index) => ({
        title: item.title,
        content: JSON.stringify(item),
        difficulty: item.difficulty,
        orderIndex: index,
        depth: 0,
      }));

      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: task.label,
          tags: parsed.tags,
          items,
        }),
      });

      if (!res.ok) throw new Error("保存模块失败");
      const saved = await res.json();

      setSaveState((prev) => ({
        ...prev,
        [task.id]: { status: "saved", moduleId: saved.id },
      }));
      // Refresh modules list so the new card appears
      refreshModules();
    } catch (err) {
      setSaveState((prev) => ({
        ...prev,
        [task.id]: {
          status: "save-failed",
          error: err instanceof Error ? err.message : "保存失败，请重试",
        },
      }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const t = topic.trim();
    if (!t || submitting || atLimit) return;

    setSubmitError(null);
    setSubmitting(true);

    try {
      // Disambiguation pre-check
      const res = await fetch("/api/knowledge/disambiguate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ambiguous && Array.isArray(data.options) && data.options.length >= 2) {
          setPendingTopic(t);
          setDisambigOptions(data.options);
          setSubmitting(false);
          return;
        }
      }
    } catch {
      // Disambiguation is best-effort; fall through to enqueue with original topic
    }

    enqueueGeneration(t);
    setSubmitting(false);
  }

  function enqueueGeneration(t: string) {
    enqueue({
      type: "generate",
      label: t,
      payload: { topic: t },
      targetItemId: null,
      moduleId: null,
    });
    setTopic("");
  }

  function handlePickOption(label: string) {
    enqueueGeneration(label);
    setPendingTopic(null);
    setDisambigOptions(null);
  }

  function handleKeepOriginal() {
    if (pendingTopic) enqueueGeneration(pendingTopic);
    setPendingTopic(null);
    setDisambigOptions(null);
  }

  function handleCancelDisambig() {
    setPendingTopic(null);
    setDisambigOptions(null);
  }

  function handleDismissTask(taskId: string) {
    // If task is queued/running, cancel; if failed/completed, just remove from local view by hiding
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status === "running" || task.status === "queued") {
      cancel(taskId);
    } else {
      // Fully remove from store so the FAB also drops it
      useTaskStore.setState((s) => ({
        tasks: s.tasks.filter((t) => t.id !== taskId),
      }));
      setSaveState((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      handlingSaveRef.current.delete(taskId);
    }
  }

  function handleRetryTask(taskId: string) {
    setSaveState((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    handlingSaveRef.current.delete(taskId);
    retry(taskId);
  }

  function handleRetrySave(task: TaskItem) {
    handlingSaveRef.current.delete(task.id);
    setSaveState((prev) => {
      const next = { ...prev };
      delete next[task.id];
      return next;
    });
    // Re-trigger save by removing flag — useEffect will pick it up
    setTimeout(() => {
      if (task.result) {
        handlingSaveRef.current.add(task.id);
        void handleSave(task);
      }
    }, 0);
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function handleDeleteModule(e: React.MouseEvent, moduleId: string) {
    e.stopPropagation();
    if (!confirm("确定要删除这个知识模块吗？删除后无法恢复。")) return;
    try {
      const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      setModules((prev) => prev.filter((m) => m.id !== moduleId));
    } catch {
      alert("删除失败，请重试");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-4 pt-20 pb-10">
        <div className="mb-3 flex items-center gap-2 text-blue-600">
          <BookOpen className="h-8 w-8" />
        </div>
        <h1 className="mb-4 text-center text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
          知识学习系统
        </h1>
        <p className="mb-10 max-w-md text-center text-lg text-gray-500">
          输入任何主题，AI 为你生成结构化知识体系（最多 {MAX_PARALLEL} 个并行任务）
        </p>

        {/* Topic Input */}
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-xl items-center gap-3"
        >
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={
              atLimit
                ? `已达 ${MAX_PARALLEL} 个并行上限，等待任务完成…`
                : "输入你想学习的主题，例如：机器学习、量子力学、区块链..."
            }
            className="h-12 flex-1 text-base shadow-md"
            disabled={atLimit || submitting}
          />
          <Button
            type="submit"
            disabled={!topic.trim() || atLimit || submitting}
            className="h-12 gap-2 px-6 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-md"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            生成知识
          </Button>
        </form>

        {submitError && (
          <p className="mt-4 text-sm text-red-500">{submitError}</p>
        )}

        {visibleGenerateTasks.length > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            正在生成 {visibleGenerateTasks.length} 个任务（{activeSlotCount}/{MAX_PARALLEL}）
          </p>
        )}
      </section>

      {/* Recent Modules + In-Flight Section */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-20">
        <div className="mb-6 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-800">最近学习</h2>
        </div>

        {modulesLoading && visibleGenerateTasks.length === 0 && (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        )}

        {modulesError && (
          <p className="py-8 text-center text-sm text-red-500">
            {modulesError}
          </p>
        )}

        {!modulesLoading &&
          !modulesError &&
          modules.length === 0 &&
          visibleGenerateTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-16 text-gray-400">
              <BookOpen className="mb-3 h-10 w-10" />
              <p>还没有学习记录，开始你的第一个主题吧！</p>
            </div>
          )}

        {(visibleGenerateTasks.length > 0 || modules.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Generating cards — one per in-flight task */}
            {visibleGenerateTasks.map((task) => (
              <GeneratingCard
                key={task.id}
                task={task}
                save={saveState[task.id]}
                onDismiss={() => handleDismissTask(task.id)}
                onRetry={() => handleRetryTask(task.id)}
                onRetrySave={() => handleRetrySave(task)}
              />
            ))}

            {modules.map((mod) => (
              <Card
                key={mod.id}
                className="cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() => router.push(`/modules/${mod.id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="truncate">{mod.topic}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={(e) => handleDeleteModule(e, mod.id)}
                        title="删除模块"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(mod.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="min-h-[3.25rem] mb-2 flex flex-wrap gap-1 content-start">
                    {mod.tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {mod.itemCount} 个知识点
                    </p>
                    <Badge
                      variant="outline"
                      className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                    >
                      已完成
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <TaskQueueFab />

      {/* Disambiguation dialog */}
      <Dialog
        open={disambigOptions !== null}
        onOpenChange={(open) => {
          if (!open) handleCancelDisambig();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>请选择你想学习的方向</DialogTitle>
            <DialogDescription>
              主题「{pendingTopic}」在多个领域都有不同含义，请选择具体方向以便生成更准确的知识体系。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
            {disambigOptions?.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handlePickOption(opt.label)}
                className="text-left rounded-lg border border-gray-200 p-3 hover:border-violet-400 hover:bg-violet-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-sm">{opt.label}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {opt.domain}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">{opt.description}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={handleCancelDisambig}>
              取消
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleKeepOriginal}
            >
              就用「{pendingTopic}」
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface GeneratingCardProps {
  task: TaskItem;
  save: SaveState | undefined;
  onDismiss: () => void;
  onRetry: () => void;
  onRetrySave: () => void;
}

function GeneratingCard({
  task,
  save,
  onDismiss,
  onRetry,
  onRetrySave,
}: GeneratingCardProps) {
  const isSaving = save?.status === "saving";
  const isSaveFailed = save?.status === "save-failed";
  const isStreamFailed = task.status === "failed";
  const isError = isStreamFailed || isSaveFailed;
  const isQueued = task.status === "queued";
  const isRunning = task.status === "running";

  // Approximate progress from parsed item count in the streamed text
  const parsedItemCount = task.result
    ? (task.result.match(/"title"\s*:/g) || []).length
    : 0;

  let statusText: string;
  if (isStreamFailed) statusText = task.error || "生成失败";
  else if (isSaveFailed) statusText = save?.error || "保存失败";
  else if (isSaving) statusText = "正在保存...";
  else if (isRunning) statusText = "AI 正在生成知识体系...";
  else if (isQueued) statusText = "排队中...";
  else statusText = "处理中...";

  return (
    <Card
      className={`relative overflow-hidden ${
        isError
          ? "border-red-200 bg-gradient-to-br from-red-50 to-orange-50"
          : "border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50"
      }`}
    >
      {!isError && (
        <div className="absolute inset-x-0 top-0 h-1 bg-violet-100">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-blue-500 animate-pulse rounded-r"
            style={{
              width: isSaving ? "92%" : `${Math.min(parsedItemCount * 12, 80)}%`,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {isError ? (
            <span className="text-red-500 shrink-0">&#10005;</span>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-violet-500 shrink-0" />
          )}
          <span className="truncate" title={task.label}>
            {task.label}
          </span>
        </CardTitle>
        <CardDescription
          className={`text-xs truncate ${
            isError ? "text-red-500" : "text-violet-500"
          }`}
          title={statusText}
        >
          {statusText}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="min-h-[3.25rem] mb-2 flex flex-wrap gap-1 content-start">
          {parsedItemCount > 0 && !isError && (
            <Badge
              variant="secondary"
              className="text-xs bg-violet-100 text-violet-600"
            >
              已识别 {parsedItemCount} 个知识点
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between">
          {isError ? (
            <div className="flex items-center gap-1">
              {isStreamFailed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-violet-500 hover:text-violet-600 px-2 h-7"
                  onClick={onRetry}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  重试
                </Button>
              )}
              {isSaveFailed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-violet-500 hover:text-violet-600 px-2 h-7"
                  onClick={onRetrySave}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  重新保存
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-red-500 hover:text-red-600 px-2 h-7"
                onClick={onDismiss}
              >
                <X className="h-3 w-3 mr-1" />
                关闭
              </Button>
            </div>
          ) : (
            <p className="text-xs text-violet-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {isQueued ? "排队中..." : "生成中..."}
            </p>
          )}
          {(isQueued || isRunning) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-400 hover:text-gray-600 px-2 h-7"
              onClick={onDismiss}
              title="取消"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
