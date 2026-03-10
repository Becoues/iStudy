"use client";

import { useState } from "react";
import {
  Bookmark,
  MessageSquare,
  X,
  Send,
  Trash2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RightPanelProps {
  favorites?: Array<{ id: string; itemId: string; title: string }>;
  onRemoveFavorite?: (itemId: string) => void;
  onFavoriteClick?: (itemId: string) => void;
  comments?: Array<{ id: string; content: string; createdAt: string }>;
  selectedItemTitle?: string;
  onAddComment?: (content: string) => void;
  onDeleteComment?: (id: string) => void;
}

export function RightPanel({
  favorites = [],
  onRemoveFavorite,
  onFavoriteClick,
  comments = [],
  selectedItemTitle,
  onAddComment,
  onDeleteComment,
}: RightPanelProps) {
  const [commentInput, setCommentInput] = useState("");

  const handleAddComment = () => {
    const trimmed = commentInput.trim();
    if (!trimmed) return;
    onAddComment?.(trimmed);
    setCommentInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAddComment();
    }
  };

  return (
    <aside className="flex w-[280px] flex-col border-l bg-background">
      <Tabs defaultValue="favorites" className="flex flex-1 flex-col">
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
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bookmark className="mb-2 size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">暂无收藏内容</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                  >
                    <button
                      type="button"
                      className="flex-1 truncate text-left text-foreground/80 hover:text-foreground"
                      onClick={() => onFavoriteClick?.(fav.itemId)}
                    >
                      {fav.title}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => onRemoveFavorite?.(fav.itemId)}
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
          {selectedItemTitle && (
            <div className="border-b px-3 py-2">
              <p className="truncate text-xs text-muted-foreground">
                {selectedItemTitle}
              </p>
            </div>
          )}

          <ScrollArea className="flex-1 p-3">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="mb-2 size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  选择一个知识要点查看评论
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="group rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <p className="text-sm text-foreground/90">
                      {comment.content}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleString("zh-CN")}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => onDeleteComment?.(comment.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
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
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAddComment}
              disabled={!commentInput.trim()}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
