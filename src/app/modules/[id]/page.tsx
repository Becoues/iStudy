"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  RefreshCw,
  Bookmark,
  MessageSquare,
  Send,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useStreamResponse } from "@/hooks/useStreamResponse";
import { parseExpansionResponse } from "@/lib/parseKnowledge";
import { KnowledgeItemList } from "@/components/knowledge/KnowledgeItemList";
import { KnowledgeToc } from "@/components/knowledge/KnowledgeToc";
import { FollowUpFab } from "@/components/knowledge/FollowUpFab";
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

  // Expansion state
  const [expandingItemId, setExpandingItemId] = useState<string | null>(null);
  const { streamText, isStreaming, error: streamError, startStream, reset: resetStream } =
    useStreamResponse();

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

  // Right panel tab
  const [activeTab, setActiveTab] = useState("favorites");

  // Follow-up
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);

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

  // Handle knowledge expansion
  const handleExpand = useCallback(
    async (item: KnowledgeItemWithChildren) => {
      if (isStreaming || expandingItemId) return;

      setExpandingItemId(item.id);
      resetStream();

      await startStream("/api/knowledge/expand", {
        title: item.content.title,
        summary: item.content.summary,
        difficulty: item.content.difficulty,
        details: item.content.details,
      });
    },
    [isStreaming, expandingItemId, startStream, resetStream]
  );

  // When streaming completes, save the new items
  useEffect(() => {
    if (!isStreaming && streamText && expandingItemId && !streamError) {
      const saveExpansion = async () => {
        try {
          const parsed = parseExpansionResponse(streamText);
          const parentItem = moduleData
            ? findItemById(moduleData.items, expandingItemId)
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
              parentId: expandingItemId,
              items: itemsToSave,
            }),
          });

          if (!res.ok) {
            throw new Error("保存展开内容失败");
          }

          // Re-fetch module data to show new children
          await fetchModule();
        } catch (err) {
          console.error("Failed to save expansion:", err);
        } finally {
          setExpandingItemId(null);
          setFollowUpQuestion(null);
          resetStream();
        }
      };

      saveExpansion();
    }
  }, [
    isStreaming,
    streamText,
    expandingItemId,
    streamError,
    moduleId,
    moduleData,
    fetchModule,
    resetStream,
  ]);

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

  // Handle follow-up question
  const handleFollowUp = useCallback(
    async (item: KnowledgeItemWithChildren, question: string) => {
      if (isStreaming || expandingItemId) return;
      setExpandingItemId(item.id);
      setFollowUpQuestion(question);
      resetStream();
      await startStream("/api/knowledge/followup", {
        title: item.content.title,
        summary: item.content.summary,
        difficulty: item.content.difficulty,
        details: item.content.details,
        question,
      });
    },
    [isStreaming, expandingItemId, startStream, resetStream]
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
          <h1 className="text-xl font-bold tracking-tight">
            {moduleData.topic}
          </h1>
        </div>
        {moduleData.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pl-10">
            {moduleData.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {/* Content area: three-column layout */}
      <div className="flex">
        {/* Left: TOC sidebar — sticky */}
        <div className="hidden lg:block shrink-0">
          <div className="sticky top-0 h-screen overflow-auto border-r bg-background w-[240px]">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">目录</h2>
            </div>
            <div className="p-2">
              <KnowledgeToc
                items={moduleData.items}
                selectedItemId={selectedItem?.id ?? null}
                onSelectItem={handleSelectItem}
              />
            </div>
          </div>
        </div>

        {/* Middle: Knowledge items */}
        <div className="flex-1 p-6">
          {/* Stream error notice */}
          {streamError && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <p className="font-medium">展开知识失败</p>
              <p className="mt-1 text-destructive/80">{streamError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setExpandingItemId(null);
                  resetStream();
                }}
              >
                关闭
              </Button>
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && expandingItemId && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>正在生成深入内容...</span>
            </div>
          )}

          <KnowledgeItemList
            items={moduleData.items}
            moduleId={moduleId}
            favorites={favorites}
            selectedItemId={selectedItem?.id ?? null}
            onToggleFavorite={handleToggleFavorite}
            onSelectItem={handleSelectItem}
            onExpandItem={handleExpand}
            onCommentItem={handleCommentItem}
            expandingItemId={expandingItemId}
          />
        </div>

        {/* Right column: Favorites + Comments panel — sticky */}
        <div className="hidden lg:block shrink-0">
          <aside className="sticky top-0 h-screen w-[280px] flex-col border-l bg-background flex">
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
          </Tabs>
          </aside>
        </div>
      </div>

      <FollowUpFab
        selectedItem={selectedItem}
        moduleId={moduleId}
        isExpanding={!!expandingItemId}
        onFollowUp={handleFollowUp}
      />
    </div>
  );
}
