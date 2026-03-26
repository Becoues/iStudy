"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  RefreshCw,
  Bookmark,
  MessageSquare,
  MessageCircle,
  Send,
  Trash2,
  Pencil,
  X,
  FileDown,
} from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useTaskQueue } from "@/hooks/useTaskQueue";
import { useTaskStore } from "@/lib/task-store";
import { parseExpansionResponse } from "@/lib/parseKnowledge";
import { insertItemIntoTree } from "@/lib/tree-utils";
import { KnowledgeItemList } from "@/components/knowledge/KnowledgeItemList";
import { KnowledgeToc } from "@/components/knowledge/KnowledgeToc";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { TaskQueueFab } from "@/components/task/TaskQueueFab";
import { ExportObsidianDialog } from "@/components/knowledge/ExportObsidianDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type {
  KnowledgeItemWithChildren,
  CommentData,
} from "@/types/knowledge";

interface ModuleData {
  id: string;
  topic: string;
  tags: string[];
  status: string;
  items: KnowledgeItemWithChildren[];
}

// Helper to find an item by id in a nested tree
function findItemById(
  items: KnowledgeItemWithChildren[],
  id: string
): KnowledgeItemWithChildren | null {
  for (const item of items) {
    if (item.id === id) return item;
    const found = findItemById(item.children, id);
    if (found) return found;
  }
  return null;
}

// Helper to collect all item IDs and titles from the tree (for favorites display)
function collectItems(
  items: KnowledgeItemWithChildren[]
): Array<{ id: string; title: string }> {
  const result: Array<{ id: string; title: string }> = [];
  for (const item of items) {
    result.push({ id: item.id, title: item.content.title });
    result.push(...collectItems(item.children));
  }
  return result;
}

export default function ModuleDetailPage() {
  const params = useParams();
  const moduleId = params.id as string;

  // Module data
  const [moduleData, setModuleData] = useState<ModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected item for comments
  const [selectedItem, setSelectedItem] =
    useState<KnowledgeItemWithChildren | null>(null);

  // Task queue for expansion (SC003 — replaces expandingItemId singleton lock)
  const { enqueue, tasks } = useTaskQueue();

  // Favorites
  const { favorites, toggleFavorite, isFavorite } = useFavorites(moduleId);

  // Comments
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Comment editing
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  // Topic & tag editing
  const [editingTopic, setEditingTopic] = useState(false);
  const [editingTopicValue, setEditingTopicValue] = useState("");
  const [editingTag, setEditingTag] = useState(false);
  const [editingTagValue, setEditingTagValue] = useState("");

  // Right panel tab
  const [activeTab, setActiveTab] = useState("favorites");

  // Scroll spy — track which item is currently in view for TOC highlighting
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const scrollSpyRef = useRef<IntersectionObserver | null>(null);

  // TOC resizable width
  const [tocWidth, setTocWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("toc-width");
      return saved ? Number(saved) : 240;
    }
    return 240;
  });
  const tocDragging = useRef(false);

  // Right panel resizable width
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("right-panel-width");
      return saved ? Number(saved) : 280;
    }
    return 280;
  });
  const rightDragging = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (tocDragging.current) {
        const newWidth = Math.min(Math.max(e.clientX, 160), 500);
        setTocWidth(newWidth);
      }
      if (rightDragging.current) {
        // Right panel: width = viewport width - mouseX
        const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 280), 500);
        setRightPanelWidth(newWidth);
      }
    };
    const onMouseUp = () => {
      if (tocDragging.current) {
        tocDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem("toc-width", String(tocWidth));
      }
      if (rightDragging.current) {
        rightDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem("right-panel-width", String(rightPanelWidth));
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [tocWidth, rightPanelWidth]);

  // Collect all item IDs from tree for scroll spy
  const collectAllIds = useCallback(
    (items: KnowledgeItemWithChildren[]): string[] => {
      const ids: string[] = [];
      for (const item of items) {
        ids.push(item.id);
        ids.push(...collectAllIds(item.children));
      }
      return ids;
    },
    []
  );

  useEffect(() => {
    if (!moduleData) return;
    const allIds = collectAllIds(moduleData.items);

    // Track which items are currently intersecting and their ratio
    const visibleItems = new Map<string, number>();

    scrollSpyRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id.replace("knowledge-item-", "");
          if (entry.isIntersecting) {
            visibleItems.set(id, entry.intersectionRatio);
          } else {
            visibleItems.delete(id);
          }
        }
        // Pick the item closest to top of viewport among visible items
        let bestId: string | null = null;
        let bestTop = Infinity;
        for (const [id] of visibleItems) {
          const el = document.getElementById(`knowledge-item-${id}`);
          if (el) {
            const rect = el.getBoundingClientRect();
            // Prefer items that are near the top of viewport
            const dist = Math.abs(rect.top);
            if (dist < bestTop) {
              bestTop = dist;
              bestId = id;
            }
          }
        }
        if (bestId) {
          setActiveItemId(bestId);
        }
      },
      { threshold: [0, 0.25, 0.5], rootMargin: "-10% 0px -60% 0px" }
    );

    for (const id of allIds) {
      const el = document.getElementById(`knowledge-item-${id}`);
      if (el) scrollSpyRef.current.observe(el);
    }

    return () => {
      scrollSpyRef.current?.disconnect();
    };
  }, [moduleData, collectAllIds]);

  // Fetch module data
  const fetchModule = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await fetch(`/api/modules/${moduleId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "加载模块失败");
      }
      const data: ModuleData = await res.json();
      setModuleData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载模块失败");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    fetchModule();
  }, [fetchModule]);

  // Fetch comments when selected item changes
  const fetchComments = useCallback(async (itemId: string) => {
    try {
      setCommentsLoading(true);
      const res = await fetch(`/api/comments/${itemId}`);
      if (!res.ok) throw new Error("加载评论失败");
      const data: CommentData[] = await res.json();
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedItem) {
      fetchComments(selectedItem.id);
    } else {
      setComments([]);
    }
  }, [selectedItem, fetchComments]);

  // Handle item selection
  const handleSelectItem = useCallback(
    (item: KnowledgeItemWithChildren) => {
      setSelectedItem((prev) => (prev?.id === item.id ? null : item));
    },
    []
  );

  // Handle comment button click on a card — select item and switch to comments tab
  const handleCommentItem = useCallback(
    (item: KnowledgeItemWithChildren) => {
      setSelectedItem(item);
      setActiveTab("comments");
    },
    []
  );

  // Handle favorite toggle
  const handleToggleFavorite = useCallback(
    (itemId: string, _title: string) => {
      toggleFavorite(itemId);
    },
    [toggleFavorite]
  );

  // SC002: Local state insert callback — adds new items to tree without fetchModule
  const handleItemCreated = useCallback(
    (newItem: KnowledgeItemWithChildren) => {
      setModuleData((prev) => {
        if (!prev) return prev;
        return { ...prev, items: insertItemIntoTree(prev.items, newItem, newItem.parentId) };
      });
    },
    []
  );

  // SC002: Local state move callback — updates tree position without fetchModule
  const handleItemMoved = useCallback(
    (itemId: string, newParentId: string | null, newIndex: number) => {
      // Import dynamically to keep top-level imports minimal (moveItemInTree is less frequently used)
      import("@/lib/tree-utils").then(({ moveItemInTree }) => {
        setModuleData((prev) => {
          if (!prev) return prev;
          return { ...prev, items: moveItemInTree(prev.items, itemId, newParentId, newIndex) };
        });
      });
    },
    []
  );

  // SC003: Handle knowledge expansion via task queue (replaces direct stream)
  const handleExpand = useCallback(
    (item: KnowledgeItemWithChildren) => {
      // Check if there's already an active task for this item
      const existingTask = useTaskStore.getState().getTaskByTargetItem(item.id);
      if (existingTask) return;

      enqueue({
        type: "expand",
        label: "深入了解: " + item.content.title,
        payload: {
          title: item.content.title,
          summary: item.content.summary,
          difficulty: item.content.difficulty,
          details: item.content.details,
        },
        targetItemId: item.id,
        moduleId,
      });
    },
    [enqueue, moduleId]
  );

  // SC003: Watch task store for completed expand/followup tasks — save results using local state insert
  const completedTasksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const relevantTasks = tasks.filter(
      (t) =>
        (t.type === "expand" || t.type === "followup") &&
        t.moduleId === moduleId &&
        t.status === "completed" &&
        t.result &&
        !completedTasksRef.current.has(t.id)
    );

    for (const task of relevantTasks) {
      completedTasksRef.current.add(task.id);

      const saveExpansionFromTask = async () => {
        try {
          const parsed = parseExpansionResponse(task.result!);
          const parentItem = moduleData
            ? findItemById(moduleData.items, task.targetItemId!)
            : null;
          const parentDepth = parentItem?.depth ?? 0;

          const itemsToSave = parsed.items.map((item, index) => ({
            title: item.title,
            content: JSON.stringify(item),
            difficulty: item.difficulty,
            orderIndex: index,
            depth: parentDepth + 1,
          }));

          const res = await fetch(`/api/modules/${moduleId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parentId: task.targetItemId,
              items: itemsToSave,
            }),
          });

          if (!res.ok) {
            throw new Error("保存展开内容失败");
          }

          // SC002: Use local state insert instead of fetchModule to prevent card collapse
          const createdItems = await res.json();
          setModuleData((prev) => {
            if (!prev) return prev;
            let newItems = prev.items;
            for (const created of createdItems) {
              // Convert Prisma response to KnowledgeItemWithChildren
              const childItem: KnowledgeItemWithChildren = {
                id: created.id,
                moduleId: created.moduleId,
                parentId: created.parentId,
                orderIndex: created.orderIndex,
                title: created.title,
                difficulty: created.difficulty,
                content: JSON.parse(created.content),
                depth: created.depth,
                children: [],
                commentCount: 0,
              };
              newItems = insertItemIntoTree(newItems, childItem, childItem.parentId);
            }
            return { ...prev, items: newItems };
          });
        } catch (err) {
          console.error("Failed to save expansion:", err);
        }
      };

      saveExpansionFromTask();
    }
  }, [tasks, moduleId, moduleData]);

  // Derive per-item expanding state from task store
  const getExpandingItemId = useCallback((): string | null => {
    const runningTask = tasks.find(
      (t) =>
        (t.type === "expand" || t.type === "followup") &&
        t.moduleId === moduleId &&
        (t.status === "running" || t.status === "queued")
    );
    return runningTask?.targetItemId ?? null;
  }, [tasks, moduleId]);

  const expandingItemId = getExpandingItemId();

  // Check if any expand/followup task is actively streaming for this module
  const isExpanding = tasks.some(
    (t) =>
      (t.type === "expand" || t.type === "followup") &&
      t.moduleId === moduleId &&
      (t.status === "running" || t.status === "queued")
  );

  // Get any error from the latest failed expand task for this module
  const latestFailedExpandTask = tasks.find(
    (t) =>
      (t.type === "expand" || t.type === "followup") &&
      t.moduleId === moduleId &&
      t.status === "failed"
  );

  // Handle adding a comment
  const handleAddComment = useCallback(async () => {
    const trimmed = commentInput.trim();
    if (!trimmed || !selectedItem) return;

    try {
      setCommentSubmitting(true);
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItem.id,
          content: trimmed,
        }),
      });
      if (!res.ok) throw new Error("添加评论失败");
      setCommentInput("");
      // Re-fetch comments and module data (for commentCount update)
      await Promise.all([fetchComments(selectedItem.id), fetchModule(true)]);
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setCommentSubmitting(false);
    }
  }, [commentInput, selectedItem, fetchComments, fetchModule]);

  // Handle deleting a comment
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        const res = await fetch(`/api/comments/${commentId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("删除评论失败");
        // Re-fetch comments and module data (for commentCount update)
        if (selectedItem) {
          await Promise.all([fetchComments(selectedItem.id), fetchModule()]);
        }
      } catch (err) {
        console.error("Failed to delete comment:", err);
      }
    },
    [selectedItem, fetchComments, fetchModule]
  );

  // Handle editing a comment
  const handleEditComment = useCallback(
    async (commentId: string) => {
      const trimmed = editingContent.trim();
      if (!trimmed) return;
      try {
        const res = await fetch(`/api/comments/${commentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        });
        if (!res.ok) throw new Error("编辑评论失败");
        setEditingCommentId(null);
        setEditingContent("");
        if (selectedItem) await fetchComments(selectedItem.id);
      } catch (err) {
        console.error("Failed to edit comment:", err);
      }
    },
    [editingContent, selectedItem, fetchComments]
  );

  // Handle delete item
  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (!confirm("确定要删除这个知识要点吗？其子项也会一并删除，且无法恢复。")) return;
      try {
        const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("删除失败");
        await fetchModule(true);
      } catch {
        alert("删除失败，请重试");
      }
    },
    [fetchModule]
  );

  // Handle move item
  const handleMoveItem = useCallback(
    async (itemId: string, direction: "up" | "down") => {
      try {
        const res = await fetch(`/api/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction }),
        });
        if (!res.ok) throw new Error("移动失败");
        await fetchModule(true);
      } catch {
        alert("移动失败，请重试");
      }
    },
    [fetchModule]
  );

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAddComment();
    }
  };

  // Build favorites list for display
  const allItems = moduleData ? collectItems(moduleData.items) : [];
  const favoriteItems = allItems.filter((item) => favorites.includes(item.id));

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="flex flex-1 gap-6">
          <div className="flex flex-1 flex-col gap-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="hidden h-96 w-[280px] rounded-xl lg:block" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !moduleData) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-destructive">
          {error || "模块数据为空"}
        </p>
        <Button variant="outline" size="sm" onClick={() => fetchModule()}>
          <RefreshCw className="size-3.5" />
          重试
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header — scrolls with content */}
      <header className="flex flex-col gap-3 border-b px-6 py-5">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon-sm" aria-label="返回">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          {editingTopic ? (
            <form
              className="flex items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmed = editingTopicValue.trim();
                if (!trimmed || trimmed === moduleData.topic) {
                  setEditingTopic(false);
                  return;
                }
                try {
                  const res = await fetch(`/api/modules/${moduleId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ topic: trimmed }),
                  });
                  if (res.ok) {
                    setModuleData((prev) =>
                      prev ? { ...prev, topic: trimmed } : prev
                    );
                  }
                } catch { /* ignore */ }
                setEditingTopic(false);
              }}
            >
              <input
                autoFocus
                className="text-xl font-bold tracking-tight bg-transparent border-b-2 border-primary outline-none"
                value={editingTopicValue}
                onChange={(e) => setEditingTopicValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditingTopic(false);
                }}
                onBlur={() => setEditingTopic(false)}
              />
            </form>
          ) : (
            <h1
              className="text-xl font-bold tracking-tight cursor-pointer hover:text-primary transition-colors group flex items-center gap-1.5"
              onClick={() => {
                setEditingTopic(true);
                setEditingTopicValue(moduleData.topic);
              }}
              title="点击编辑标题"
            >
              {moduleData.topic}
              <Pencil className="size-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
            </h1>
          )}
          <ExportObsidianDialog
            moduleId={moduleId}
            moduleTopic={moduleData.topic}
            trigger={
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                <FileDown className="size-3.5" />
                导出到 Obsidian
              </Button>
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pl-10">
          {moduleData.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs group/tag cursor-pointer hover:bg-destructive/20 transition-colors"
              onClick={async () => {
                const newTags = moduleData.tags.filter((t) => t !== tag);
                try {
                  const res = await fetch(`/api/modules/${moduleId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tags: newTags }),
                  });
                  if (res.ok) {
                    setModuleData((prev) => prev ? { ...prev, tags: newTags } : prev);
                  }
                } catch { /* ignore */ }
              }}
              title="点击删除标签"
            >
              {tag}
              <X className="size-3 ml-0.5 opacity-0 group-hover/tag:opacity-70 transition-opacity" />
            </Badge>
          ))}
          {editingTag ? (
            <input
              autoFocus
              className="h-5 w-24 rounded-md border bg-transparent px-2 text-xs outline-none focus:border-primary"
              placeholder="输入标签..."
              value={editingTagValue}
              onChange={(e) => setEditingTagValue(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Escape") {
                  setEditingTag(false);
                  setEditingTagValue("");
                }
                if (e.key === "Enter") {
                  const trimmed = editingTagValue.trim();
                  if (!trimmed || moduleData.tags.includes(trimmed)) {
                    setEditingTag(false);
                    setEditingTagValue("");
                    return;
                  }
                  const newTags = [...moduleData.tags, trimmed];
                  try {
                    const res = await fetch(`/api/modules/${moduleId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tags: newTags }),
                    });
                    if (res.ok) {
                      setModuleData((prev) => prev ? { ...prev, tags: newTags } : prev);
                    }
                  } catch { /* ignore */ }
                  setEditingTag(false);
                  setEditingTagValue("");
                }
              }}
              onBlur={() => {
                setEditingTag(false);
                setEditingTagValue("");
              }}
            />
          ) : (
            <Badge
              variant="outline"
              className="text-xs cursor-pointer hover:bg-muted transition-colors border-dashed"
              onClick={() => setEditingTag(true)}
            >
              + 添加标签
            </Badge>
          )}
        </div>
      </header>

      {/* Content area: three-column layout */}
      <div className="flex">
        {/* Left: TOC sidebar — sticky, resizable */}
        <div className="hidden lg:block shrink-0 relative">
          <div
            className="sticky top-0 h-screen overflow-auto border-r bg-background"
            style={{ width: `${tocWidth}px` }}
          >
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">目录</h2>
            </div>
            <div className="p-2">
              <KnowledgeToc
                items={moduleData.items}
                selectedItemId={activeItemId}
                onSelectItem={handleSelectItem}
                onDeleteItem={handleDeleteItem}
                onMoveItem={handleMoveItem}
              />
            </div>
          </div>
          {/* Drag handle */}
          <div
            className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              tocDragging.current = true;
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
            }}
          />
        </div>

        {/* Middle: Knowledge items */}
        <div className="flex-1 p-6">
          {/* Error notice for failed expand tasks */}
          {latestFailedExpandTask && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <p className="font-medium">展开知识失败</p>
              <p className="mt-1 text-destructive/80">{latestFailedExpandTask.error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  useTaskStore.getState().clearCompleted();
                }}
              >
                关闭
              </Button>
            </div>
          )}

          {/* Streaming indicator — show when any expand task is running */}
          {isExpanding && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>正在生成深入内容...</span>
            </div>
          )}

          <KnowledgeItemList
            items={moduleData.items}
            moduleId={moduleId}
            moduleTopic={moduleData.topic}
            favorites={favorites}
            selectedItemId={selectedItem?.id ?? null}
            onToggleFavorite={handleToggleFavorite}
            onSelectItem={handleSelectItem}
            onExpandItem={handleExpand}
            onCommentItem={handleCommentItem}
            expandingItemId={expandingItemId}
          />
        </div>

        {/* Right column: Favorites + Comments + Chat panel — sticky, resizable */}
        <div className="hidden lg:block shrink-0 relative">
          {/* Left-side drag handle for right panel */}
          <div
            className="absolute top-0 left-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              rightDragging.current = true;
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
            }}
          />
          <aside
            className="sticky top-0 h-screen flex-col border-l bg-background flex overflow-hidden"
            style={{ width: `${rightPanelWidth}px` }}
          >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="mx-3 mt-3">
              <TabsTrigger value="favorites" className="gap-1.5">
                <Bookmark className="size-3.5" />
                收藏
              </TabsTrigger>
              <TabsTrigger value="comments" className="gap-1.5">
                <MessageSquare className="size-3.5" />
                评论
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-1.5">
                <MessageCircle className="size-3.5" />
                聊天
              </TabsTrigger>
            </TabsList>

            {/* Favorites Tab */}
            <TabsContent value="favorites" className="flex flex-1 flex-col">
              <ScrollArea className="flex-1 p-3">
                {favoriteItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Bookmark className="mb-2 size-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      暂无收藏内容
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      点击知识卡片上的爱心图标收藏
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {favoriteItems.map((fav) => (
                      <div
                        key={fav.id}
                        className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                      >
                        <button
                          type="button"
                          className="flex-1 truncate text-left text-foreground/80 hover:text-foreground"
                          onClick={() => {
                            const foundItem = findItemById(
                              moduleData.items,
                              fav.id
                            );
                            if (foundItem) {
                              setSelectedItem(foundItem);
                              // Scroll to item - find the card element
                              const el = document.getElementById(
                                `knowledge-item-${fav.id}`
                              );
                              el?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                            }
                          }}
                        >
                          {fav.title}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => toggleFavorite(fav.id)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Comments Tab */}
            <TabsContent value="comments" className="flex flex-1 flex-col">
              {selectedItem ? (
                <>
                  <div className="border-b px-3 py-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {selectedItem.content.title}
                    </p>
                  </div>

                  <ScrollArea className="flex-1 p-3">
                    {commentsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <MessageSquare className="mb-2 size-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                          暂无评论
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="group rounded-lg bg-muted/40 px-3 py-2"
                          >
                            {editingCommentId === comment.id ? (
                              <div className="flex flex-col gap-2">
                                <Input
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                      e.preventDefault();
                                      handleEditComment(comment.id);
                                    }
                                    if (e.key === "Escape") {
                                      setEditingCommentId(null);
                                    }
                                  }}
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <Button size="sm" variant="default" onClick={() => handleEditComment(comment.id)}>
                                    保存
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingCommentId(null)}>
                                    取消
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-foreground/90">
                                  {comment.content}
                                </p>
                                <div className="mt-1 flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(comment.createdAt).toLocaleString(
                                      "zh-CN"
                                    )}
                                  </span>
                                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setEditingContent(comment.content);
                                      }}
                                    >
                                      <Pencil className="size-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() =>
                                        handleDeleteComment(comment.id)
                                      }
                                    >
                                      <Trash2 className="size-3" />
                                    </Button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Comment input */}
                  <div className="flex items-center gap-2 border-t p-3">
                    <Input
                      placeholder="添加评论..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      onKeyDown={handleCommentKeyDown}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleAddComment}
                      disabled={!commentInput.trim() || commentSubmitting}
                    >
                      {commentSubmitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center py-12 text-center px-3">
                  <MessageSquare className="mb-2 size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    选择一个知识要点查看评论
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="flex flex-1 flex-col overflow-hidden min-h-0">
              <ChatPanel
                moduleId={moduleId}
                moduleData={{ topic: moduleData.topic, items: moduleData.items }}
                selectedItem={selectedItem}
                onItemCreated={handleItemCreated}
              />
            </TabsContent>
          </Tabs>
          </aside>
        </div>
      </div>

      <TaskQueueFab />
    </div>
  );
}
