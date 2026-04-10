"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, BookOpen, ArrowRight, Loader2, Trash2, Hash, Calendar } from "lucide-react";
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
import { useTaskQueue } from "@/hooks/useTaskQueue";
import { parseGenerationResponse } from "@/lib/parseKnowledge";
import { TaskQueueFab } from "@/components/task/TaskQueueFab";
import type { ModuleListItem } from "@/types/knowledge";

// Persist generating state across navigation
const GENERATING_KEY = "istudy-generating";

function getGeneratingState(): { topic: string; startedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GENERATING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire after 5 minutes
    if (Date.now() - parsed.startedAt > 5 * 60 * 1000) {
      localStorage.removeItem(GENERATING_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [modules, setModules] = useState<ModuleListItem[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generatingTopic, setGeneratingTopic] = useState<string | null>(null);
  const [genFailed, setGenFailed] = useState(false);

  // SC003: Task queue integration
  const { enqueue, tasks } = useTaskQueue();

  // Track which generate task we're watching
  const [activeGenTaskId, setActiveGenTaskId] = useState<string | null>(null);
  const completedGenTasksRef = useRef<Set<string>>(new Set());

  // Find the active generate task from the store
  const activeGenTask = activeGenTaskId
    ? tasks.find((t) => t.id === activeGenTaskId) ?? null
    : null;

  // Derive streaming/error state from the task
  const isStreaming = activeGenTask?.status === "running" || activeGenTask?.status === "queued";
  const streamError = activeGenTask?.status === "failed" ? activeGenTask.error : null;
  const streamText = activeGenTask?.result ?? "";

  // Restore generating state on mount
  useEffect(() => {
    const state = getGeneratingState();
    if (state) {
      setGeneratingTopic(state.topic);
    }
  }, []);

  // Fetch recent modules on mount
  useEffect(() => {
    async function fetchModules() {
      try {
        const res = await fetch("/api/modules?sort=desc");
        if (!res.ok) throw new Error("获取模块列表失败");
        const data: ModuleListItem[] = await res.json();
        setModules(data.slice(0, 6));
      } catch (err) {
        setModulesError(err instanceof Error ? err.message : "获取模块列表失败");
      } finally {
        setModulesLoading(false);
      }
    }
    fetchModules();
  }, []);

  // SC003: Watch for task completion and save the result
  useEffect(() => {
    if (!activeGenTaskId) return;

    const task = tasks.find((t) => t.id === activeGenTaskId);
    if (!task) return;

    if (task.status === "completed" && task.result && !completedGenTasksRef.current.has(task.id)) {
      completedGenTasksRef.current.add(task.id);
      handleSave(task.result, generatingTopic || topic);
    }
  }, [tasks, activeGenTaskId]);

  async function handleSave(resultText: string, saveTopic: string) {
    setSaving(true);
    setSaveError(null);
    try {
      const parsed = parseGenerationResponse(resultText);

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
          topic: saveTopic,
          tags: parsed.tags,
          items,
        }),
      });

      if (!res.ok) throw new Error("保存模块失败");

      const saved = await res.json();
      setTopic("");
      setGeneratingTopic(null);
      setActiveGenTaskId(null);
      localStorage.removeItem(GENERATING_KEY);
      router.push(`/modules/${saved.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败，请重试");
      setGenFailed(true);
      localStorage.removeItem(GENERATING_KEY);
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() || isStreaming) return;
    setSaveError(null);
    setGenFailed(false);
    const t = topic.trim();
    setGeneratingTopic(t);
    localStorage.setItem(GENERATING_KEY, JSON.stringify({ topic: t, startedAt: Date.now() }));

    // SC003: Enqueue generation task instead of calling startStream directly
    const taskId = enqueue({
      type: "generate",
      label: t,
      payload: { topic: t },
      targetItemId: null,
      moduleId: null,
    });
    setActiveGenTaskId(taskId);
  }

  function handleReset() {
    setGeneratingTopic(null);
    setGenFailed(false);
    setSaveError(null);
    setActiveGenTaskId(null);
    localStorage.removeItem(GENERATING_KEY);
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

  // Currently generating or have a pending generation?
  const showGeneratingCard = isStreaming || saving || (generatingTopic && !streamError) || genFailed;

  // Progress indicator: count parsed items so far from stream
  const parsedItemCount = streamText
    ? (streamText.match(/"title"\s*:/g) || []).length
    : 0;

  // Bytes received for more granular progress
  const bytesReceived = activeGenTask?.bytesReceived ?? 0;

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
          输入任何主题，AI 为你生成结构化知识体系
        </p>

        {/* Topic Input */}
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-xl items-center gap-3"
        >
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="输入你想学习的主题，例如：机器学习、量子力学、区块链..."
            className="h-12 flex-1 text-base shadow-md"
            disabled={isStreaming || saving}
          />
          <Button
            type="submit"
            disabled={!topic.trim() || isStreaming || saving}
            className="h-12 gap-2 px-6 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-md"
          >
            <Sparkles className="h-4 w-4" />
            生成知识
          </Button>
        </form>

        {/* Stream Error */}
        {streamError && (
          <p className="mt-4 text-sm text-red-500">
            生成失败：{streamError}
          </p>
        )}

        {/* Save Error */}
        {saveError && (
          <p className="mt-4 text-sm text-red-500">
            {saveError}
          </p>
        )}
      </section>

      {/* Recent Modules Section */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-20">
        <div className="mb-6 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-800">最近学习</h2>
        </div>

        {modulesLoading && (
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

        {!modulesLoading && !modulesError && modules.length === 0 && !showGeneratingCard && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-16 text-gray-400">
            <BookOpen className="mb-3 h-10 w-10" />
            <p>还没有学习记录，开始你的第一个主题吧！</p>
          </div>
        )}

        {(!modulesLoading || showGeneratingCard) && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Generating card — always first */}
            {showGeneratingCard && (
              <Card className={`relative overflow-hidden ${genFailed || streamError ? "border-red-200 bg-gradient-to-br from-red-50 to-orange-50" : "border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50"}`}>
                {/* Animated progress bar */}
                {!genFailed && !streamError && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-violet-100">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-blue-500 animate-pulse rounded-r"
                      style={{ width: saving ? "90%" : `${Math.min(parsedItemCount * 15, 80)}%`, transition: "width 0.5s ease" }}
                    />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {genFailed || streamError ? (
                      <span className="text-red-500 shrink-0">&#10005;</span>
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-violet-500 shrink-0" />
                    )}
                    <span className="truncate">{generatingTopic}</span>
                  </CardTitle>
                  <CardDescription className={`text-xs ${genFailed || streamError ? "text-red-500" : "text-violet-500"}`}>
                    {genFailed ? (saveError || "生成失败") : streamError ? streamError : saving ? "正在保存..." : isStreaming ? "AI 正在生成知识体系..." : "准备中..."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="min-h-[3.25rem] mb-2 flex flex-wrap gap-1 content-start">
                    {parsedItemCount > 0 && !genFailed && (
                      <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-600">
                        已识别 {parsedItemCount} 个知识点
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    {genFailed || streamError ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-red-500 hover:text-red-600 px-2 h-7"
                        onClick={handleReset}
                      >
                        关闭
                      </Button>
                    ) : (
                      <p className="text-xs text-violet-400 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        生成中...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

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
                  {/* Fixed 2-row tag area for alignment */}
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
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
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
    </div>
  );
}
