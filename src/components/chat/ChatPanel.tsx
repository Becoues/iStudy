"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Sparkles, Trash2, Pin, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useModuleChat } from "@/hooks/useModuleChat";
import { CondensePreview } from "@/components/chat/CondensePreview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { KnowledgeItemWithChildren, KnowledgeItemData } from "@/types/knowledge";

interface ChatPanelProps {
  moduleId: string;
  moduleData: {
    topic: string;
    items: KnowledgeItemWithChildren[];
  };
  selectedItem?: KnowledgeItemWithChildren | null;
  onItemCreated: (item: KnowledgeItemWithChildren) => void;
}

function collectItemSummaries(
  items: KnowledgeItemWithChildren[]
): Array<{ title: string; summary: string }> {
  const result: Array<{ title: string; summary: string }> = [];
  for (const item of items) {
    result.push({ title: item.content.title, summary: item.content.summary });
    result.push(...collectItemSummaries(item.children));
  }
  return result;
}

export function ChatPanel({ moduleId, moduleData, selectedItem, onItemCreated }: ChatPanelProps) {
  // Pinned context item — user can pin a knowledge card to focus the chat
  const [pinnedItem, setPinnedItem] = useState<KnowledgeItemWithChildren | null>(null);

  // Effective focused item: pinned (locked) takes priority, otherwise use selected
  const effectiveItem = pinnedItem ?? selectedItem ?? null;

  const context = {
    topic: moduleData.topic,
    items: collectItemSummaries(moduleData.items),
    focusedItem: effectiveItem
      ? { title: effectiveItem.content.title, summary: effectiveItem.content.summary, details: effectiveItem.content.details }
      : undefined,
  };

  const { messages, isStreaming, error, sendMessage, condense, clear } =
    useModuleChat(moduleId, context);

  const [input, setInput] = useState("");
  const [condensing, setCondensing] = useState(false);
  const [condenseData, setCondenseData] = useState<KnowledgeItemData | null>(null);
  const [showCondensePreview, setShowCondensePreview] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isStreaming]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCondense = useCallback(async () => {
    if (messages.length === 0 || condensing) return;
    setCondensing(true);
    const data = await condense();
    setCondensing(false);
    if (data) {
      setCondenseData(data);
      setShowCondensePreview(true);
    }
  }, [messages.length, condensing, condense]);

  const handleCondenseClose = useCallback(() => {
    setShowCondensePreview(false);
    setCondenseData(null);
  }, []);

  // Pin the selected item from left panel as context
  const handlePinSelected = useCallback(() => {
    if (selectedItem) {
      setPinnedItem(selectedItem);
    }
  }, [selectedItem]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            disabled={messages.length === 0 || isStreaming || condensing}
            onClick={handleCondense}
          >
            {condensing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
            凝练为知识卡片
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={clear}
          disabled={messages.length === 0 && !isStreaming}
          title="清空对话"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      {/* Context indicator: locked (pinned) or auto-associated (selected) */}
      {pinnedItem ? (
        <div className="flex items-center gap-1.5 border-b bg-muted/30 px-3 py-1.5 shrink-0">
          <Pin className="size-3 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1">
            已锁定: {pinnedItem.content.title}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setPinnedItem(null)}
            title="解除锁定"
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : selectedItem ? (
        <div className="flex items-center gap-1.5 border-b bg-primary/5 px-3 py-1.5 shrink-0">
          <span className="text-xs text-muted-foreground truncate flex-1">
            当前关联: {selectedItem.content.title}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handlePinSelected}
            title="锁定此知识点（切换选中不影响聊天）"
          >
            <Pin className="size-3" />
          </Button>
        </div>
      ) : null}

      {/* Message list — use native overflow instead of ScrollArea for reliable scrolling */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-2 p-3">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                围绕&ldquo;{moduleData.topic}&rdquo;提问
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {effectiveItem
                  ? `当前关联: ${effectiveItem.content.title}`
                  : "点击左侧卡片选中知识点即可关联聊天"}
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-foreground"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-xs dark:prose-invert max-w-none [&_p]:my-1 [&_pre]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-[10px] [&_p]:text-xs [&_li]:text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content || "\u200B"}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {isStreaming && messages.length > 0 && messages[messages.length - 1].content === "" && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                思考中...
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-3 mb-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive shrink-0">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-3 shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            placeholder={effectiveItem ? `关于「${effectiveItem.content.title}」提问...` : "输入消息..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            className="min-h-[36px] max-h-[120px] resize-none text-xs py-2"
            rows={1}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Condense preview dialog */}
      {showCondensePreview && condenseData && (
        <CondensePreview
          open={showCondensePreview}
          onClose={handleCondenseClose}
          data={condenseData}
          moduleId={moduleId}
          items={moduleData.items}
          onItemCreated={onItemCreated}
        />
      )}
    </div>
  );
}
