"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, BookOpen, ArrowRight, Loader2 } from "lucide-react";
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
import { useStreamResponse } from "@/hooks/useStreamResponse";
import { parseGenerationResponse } from "@/lib/parseKnowledge";
import type { ModuleListItem } from "@/types/knowledge";

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [modules, setModules] = useState<ModuleListItem[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { streamText, isStreaming, error: streamError, startStream, reset } = useStreamResponse();
  const streamContainerRef = useRef<HTMLDivElement>(null);
  const prevStreamingRef = useRef(false);

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

  // Auto-scroll streaming container
  useEffect(() => {
    if (streamContainerRef.current && isStreaming) {
      streamContainerRef.current.scrollTop = streamContainerRef.current.scrollHeight;
    }
  }, [streamText, isStreaming]);

  // When streaming completes, parse and save
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && streamText && !streamError) {
      handleSave();
    }
    prevStreamingRef.current = isStreaming;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const parsed = parseGenerationResponse(streamText);

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
          topic,
          tags: parsed.tags,
          items,
        }),
      });

      if (!res.ok) throw new Error("保存模块失败");

      const saved = await res.json();
      reset();
      setTopic("");
      router.push(`/modules/${saved.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() || isStreaming) return;
    setSaveError(null);
    startStream("/api/knowledge/generate", { topic: topic.trim() });
  }

  const showStreamView = isStreaming || streamText;

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

      {/* Streaming / Generating View */}
      {showStreamView && (
        <section className="mx-auto mb-12 w-full max-w-3xl px-4">
          <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
            {(isStreaming || saving) && (
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            )}
            <span>
              {saving
                ? "正在保存知识模块..."
                : isStreaming
                  ? "正在为您生成知识点..."
                  : "生成完成"}
            </span>
          </div>
          <div
            ref={streamContainerRef}
            className="rounded-lg bg-gray-950 p-4 font-mono text-sm text-emerald-400 max-h-[400px] overflow-y-auto shadow-lg"
          >
            <pre className="whitespace-pre-wrap break-words">{streamText || " "}</pre>
          </div>
        </section>
      )}

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

        {!modulesLoading && !modulesError && modules.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-16 text-gray-400">
            <BookOpen className="mb-3 h-10 w-10" />
            <p>还没有学习记录，开始你的第一个主题吧！</p>
          </div>
        )}

        {!modulesLoading && !modulesError && modules.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => (
              <Card
                key={mod.id}
                className="cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() => router.push(`/modules/${mod.id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="truncate">{mod.topic}</span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-400">
                    {formatDate(mod.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {mod.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    {mod.itemCount} 个知识点
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
