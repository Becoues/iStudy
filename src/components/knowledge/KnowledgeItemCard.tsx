"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Heart,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Loader2,
  ImagePlus,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { DifficultyBadge } from "@/components/knowledge/DifficultyBadge";
import { MermaidDiagram } from "@/components/knowledge/MermaidDiagram";
import { QuizSection } from "@/components/knowledge/QuizSection";
import type { KnowledgeItemWithChildren } from "@/types/knowledge";

function processHighlights(text: string): string {
  return text.replace(/==(.*?)==/g, '<mark>$1</mark>');
}

interface KnowledgeItemCardProps {
  item: KnowledgeItemWithChildren;
  moduleId: string;
  isFavorite: boolean;
  isSelected: boolean;
  onToggleFavorite: (itemId: string, title: string) => void;
  onSelect: (item: KnowledgeItemWithChildren) => void;
  onExpand: (item: KnowledgeItemWithChildren) => void;
  onComment?: (item: KnowledgeItemWithChildren) => void;
  isExpanding?: boolean;
  maxDepth?: number;
  favorites?: string[];
  selectedItemId?: string | null;
}

export function KnowledgeItemCard({
  item,
  moduleId,
  isFavorite,
  isSelected,
  onToggleFavorite,
  onSelect,
  onExpand,
  onComment,
  isExpanding = false,
  maxDepth = 3,
  favorites = [],
  selectedItemId = null,
}: KnowledgeItemCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>(item.content.imageUrl);
  const [imageGenerating, setImageGenerating] = useState(false);

  // Sync imageUrl when item prop changes (e.g. after parent re-fetches module data)
  useEffect(() => {
    setImageUrl(item.content.imageUrl);
  }, [item.content.imageUrl]);

  const handleCardClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("button, a, img, [role='button'], [data-slot='collapsible-trigger']")) {
        return;
      }
      onSelect(item);
    },
    [item, onSelect]
  );

  const handleGenerateImage = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setImageGenerating(true);
      try {
        const res = await fetch("/api/knowledge/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: item.id,
            title: item.content.title,
            summary: item.content.summary,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "生成配图失败");
        }
        const data = await res.json();
        setImageUrl(data.imageUrl);
      } catch (err) {
        console.error("Failed to generate image:", err);
      } finally {
        setImageGenerating(false);
      }
    },
    [item.id, item.content.title, item.content.summary]
  );

  return (
    <div className="flex flex-col gap-0" id={`knowledge-item-${item.id}`}>
      <Card
        className={cn(
          "cursor-pointer transition-all duration-200",
          isSelected
            ? "ring-2 ring-primary/50 shadow-md"
            : "hover:shadow-sm hover:ring-1 hover:ring-foreground/5"
        )}
        onClick={handleCardClick}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4">
          <h3 className="flex-1 text-base font-semibold leading-snug">
            {item.content.title}
          </h3>
          <DifficultyBadge
            difficulty={item.content.difficulty}
            className="shrink-0"
          />
          {item.commentCount > 0 && (
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onComment?.(item);
              }}
            >
              <MessageSquare className="size-3" />
              {item.commentCount}
            </button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id, item.content.title);
            }}
            aria-label={isFavorite ? "取消收藏" : "收藏"}
          >
            <Heart
              className={cn(
                "size-4 transition-colors",
                isFavorite
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground"
              )}
            />
          </Button>
        </div>

        <CardContent className="flex flex-col gap-3">
          {/* Summary */}
          <p className="text-sm italic text-muted-foreground leading-relaxed">
            {item.content.summary}
          </p>

          {/* Generated image */}
          {imageUrl && (
            <div className="rounded-lg overflow-hidden border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`${item.content.title} 配图`}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          )}

          {/* Generate image button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 self-start"
            disabled={imageGenerating}
            onClick={handleGenerateImage}
          >
            {imageGenerating ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                正在生成配图...
              </>
            ) : imageUrl ? (
              <>
                <ImagePlus className="size-3.5" />
                重新生成配图
              </>
            ) : (
              <>
                <ImagePlus className="size-3.5" />
                生成配图
              </>
            )}
          </Button>

          {/* Expandable details */}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-200",
                  detailsOpen && "rotate-180"
                )}
              />
              {detailsOpen ? "收起详情" : "展开详情"}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 flex flex-col gap-4">
                {/* Details rendered as markdown */}
                <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg bg-muted/30 p-4 text-sm leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
                    components={{
                      h2: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2 text-foreground">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1.5 text-foreground">{children}</h3>,
                      mark: ({ children }) => <mark className="bg-yellow-200/80 dark:bg-yellow-500/30 px-0.5 rounded">{children}</mark>,
                      code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        if (isInline) {
                          return <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary" {...props}>{children}</code>;
                        }
                        return <code className={className} {...props}>{children}</code>;
                      },
                    }}
                  >
                    {processHighlights(item.content.details)}
                  </ReactMarkdown>
                </div>

                {/* Mermaid diagram */}
                {item.content.mermaid && (
                  <MermaidDiagram code={item.content.mermaid} />
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Quiz section */}
          <QuizSection quiz={item.content.quiz} />

          {/* Expand deeper button */}
          {item.depth < maxDepth && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 self-start"
              disabled={isExpanding}
              onClick={(e) => {
                e.stopPropagation();
                onExpand(item);
              }}
            >
              {isExpanding ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  正在展开...
                </>
              ) : (
                <>
                  <ChevronRight className="size-3.5" />
                  深入了解
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Recursive children */}
      {item.children.length > 0 && (
        <div className="ml-6 border-l-2 border-border pl-4 pt-4 flex flex-col gap-4">
          {item.children.map((child) => (
            <KnowledgeItemCard
              key={child.id}
              item={child}
              moduleId={moduleId}
              isFavorite={favorites.includes(child.id)}
              isSelected={selectedItemId === child.id}
              onToggleFavorite={onToggleFavorite}
              onSelect={onSelect}
              onExpand={onExpand}
              onComment={onComment}
              maxDepth={maxDepth}
              favorites={favorites}
              selectedItemId={selectedItemId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
