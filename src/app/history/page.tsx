"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  BookOpen,
  Trash2,
  Calendar,
  Hash,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModuleListItem {
  id: string;
  topic: string;
  tags: string[];
  itemCount: number;
  status: string;
  createdAt: string;
}

type SortOption = "newest" | "oldest" | "topic";

export default function HistoryPage() {
  const [modules, setModules] = useState<ModuleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchModules();
  }, []);

  async function fetchModules() {
    try {
      setLoading(true);
      const res = await fetch("/api/modules");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ModuleListItem[] = await res.json();
      setModules(data);
    } catch {
      // silently handle - empty state will show
    } finally {
      setLoading(false);
    }
  }

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const mod of modules) {
      for (const tag of mod.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [modules]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedTags(new Set());
  }, []);

  const filteredAndSorted = useMemo(() => {
    let result = modules;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((mod) =>
        mod.topic.toLowerCase().includes(query)
      );
    }

    // Tag filter (OR logic - module must match ANY selected tag)
    if (selectedTags.size > 0) {
      result = result.filter((mod) =>
        mod.tags.some((tag) => selectedTags.has(tag))
      );
    }

    // Sort
    const sorted = [...result];
    switch (sortBy) {
      case "newest":
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case "oldest":
        sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case "topic":
        sorted.sort((a, b) => a.topic.localeCompare(b.topic, "zh-CN"));
        break;
    }

    return sorted;
  }, [modules, searchQuery, selectedTags, sortBy]);

  async function handleDelete(id: string) {
    try {
      setDeletingId(id);
      const res = await fetch(`/api/modules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setModules((prev) => prev.filter((mod) => mod.id !== id));
    } catch {
      // Could add toast notification here
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-transparent">
            已完成
          </Badge>
        );
      case "generating":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-transparent">
            <Loader2 className="size-3 animate-spin" />
            生成中
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            失败
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state: no modules at all
  if (modules.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
        <BookOpen className="size-16 text-muted-foreground/50" />
        <h2 className="text-xl font-medium text-muted-foreground">
          还没有学习记录
        </h2>
        <Button nativeButton={false} render={<Link href="/" />}>
          开始学习
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">学习记录</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          查看和管理你的所有知识模块
        </p>
      </div>

      {/* Search and Sort */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索知识模块..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
          <SelectTrigger className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">最新优先</SelectItem>
            <SelectItem value="oldest">最早优先</SelectItem>
            <SelectItem value="topic">按主题排序</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button key={tag} type="button" onClick={() => toggleTag(tag)}>
              <Badge
                variant={selectedTags.has(tag) ? "default" : "outline"}
                className="cursor-pointer"
              >
                {tag}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {filteredAndSorted.length === 0 ? (
        // Empty state: filters yield no results
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <p className="text-lg font-medium text-muted-foreground">
            没有匹配的知识模块
          </p>
          <p className="text-sm text-muted-foreground">
            试试其他搜索词或清除筛选条件
          </p>
          <Button variant="outline" onClick={clearFilters}>
            清除筛选
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSorted.map((mod) => (
            <Link
              key={mod.id}
              href={`/modules/${mod.id}`}
              className="group/link block"
            >
              <Card className="h-full transition-shadow duration-200 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{mod.topic}</span>
                  </CardTitle>
                  {mod.tags.length > 0 && (
                    <CardDescription className="flex flex-wrap gap-1 pt-1">
                      {mod.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Hash className="size-3.5" />
                      <span>{mod.itemCount} 个知识点</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      <span>{formatDate(mod.createdAt)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-between">
                  {getStatusBadge(mod.status)}
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 transition-opacity group-hover/link:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.preventDefault()}
                        />
                      }
                    >
                      <Trash2 className="size-4" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                          确定要删除这个知识模块吗？删除后无法恢复。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          disabled={deletingId === mod.id}
                          onClick={(e) => {
                            e.preventDefault();
                            handleDelete(mod.id);
                          }}
                        >
                          {deletingId === mod.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : null}
                          删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
