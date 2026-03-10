"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MessageCircleQuestion, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { KnowledgeItemWithChildren } from "@/types/knowledge";

interface FollowUpFabProps {
  selectedItem: KnowledgeItemWithChildren | null;
  moduleId: string;
  isExpanding: boolean;
  onFollowUp: (item: KnowledgeItemWithChildren, question: string) => void;
}

const FAB_SIZE = 56; // size-14 = 3.5rem = 56px
const EDGE_MARGIN = 24; // distance from viewport edge when snapped
const DRAG_THRESHOLD = 5; // pixels moved before considered a drag

export function FollowUpFab({
  selectedItem,
  moduleId,
  isExpanding,
  onFollowUp,
}: FollowUpFabProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const dragging = useRef(false);
  const wasDragged = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const fabRef = useRef<HTMLDivElement>(null);

  // Initialize position to bottom-right
  useEffect(() => {
    if (!initialized && typeof window !== "undefined") {
      setPosition({
        x: window.innerWidth - FAB_SIZE - EDGE_MARGIN,
        y: window.innerHeight - FAB_SIZE - EDGE_MARGIN,
      });
      setInitialized(true);
    }
  }, [initialized]);

  // Snap to nearest horizontal edge
  const snapToEdge = useCallback((x: number, y: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Clamp y within viewport
    const clampedY = Math.max(EDGE_MARGIN, Math.min(y, vh - FAB_SIZE - EDGE_MARGIN));

    // Snap to nearest left/right edge
    const midX = (vw - FAB_SIZE) / 2;
    const snappedX = x < midX ? EDGE_MARGIN : vw - FAB_SIZE - EDGE_MARGIN;

    return { x: snappedX, y: clampedY };
  }, []);

  // Pointer events for dragging
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (open) return; // don't drag when panel is open
      dragging.current = true;
      wasDragged.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY };
      posStart.current = { ...position };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [open, position]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;

      if (!wasDragged.current && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
        wasDragged.current = true;
      }

      if (wasDragged.current) {
        setPosition({
          x: posStart.current.x + dx,
          y: posStart.current.y + dy,
        });
      }
    },
    []
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      if (wasDragged.current) {
        // Snap to edge with transition
        const snapped = snapToEdge(
          posStart.current.x + (e.clientX - dragStart.current.x),
          posStart.current.y + (e.clientY - dragStart.current.y)
        );
        setPosition(snapped);
      }
    },
    [snapToEdge]
  );

  const handleFabClick = useCallback(() => {
    if (wasDragged.current) return; // ignore click after drag
    setOpen((prev) => !prev);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedItem || !question.trim() || isExpanding) return;
    onFollowUp(selectedItem, question.trim());
    setQuestion("");
    setOpen(false);
  }, [selectedItem, question, isExpanding, onFollowUp]);

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => snapToEdge(prev.x, prev.y));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [snapToEdge]);

  // Determine if FAB is on the left side
  const isOnLeft = initialized && position.x < (typeof window !== "undefined" ? window.innerWidth : 9999) / 2;

  if (!initialized) return null;

  return (
    <div
      ref={fabRef}
      className="fixed z-50 flex flex-col items-end gap-3"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        // Align panel based on which side FAB is on
        alignItems: isOnLeft ? "flex-start" : "flex-end",
      }}
    >
      {/* Expanded panel — positioned above the FAB */}
      {open && (
        <div
          className="absolute w-[360px] rounded-xl border bg-background p-4 shadow-2xl"
          style={{
            bottom: `${FAB_SIZE + 12}px`,
            ...(isOnLeft ? { left: 0 } : { right: 0 }),
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">追问</h3>
            <Button variant="ghost" size="icon-xs" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>

          {selectedItem ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground mb-0.5">当前知识点</p>
                <p className="text-sm font-medium truncate">{selectedItem.content.title}</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="输入你的问题..."
                  disabled={isExpanding}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
                <Button
                  size="icon"
                  disabled={!question.trim() || isExpanding}
                  onClick={handleSubmit}
                >
                  {isExpanding ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              请先点击选择一个知识点
            </p>
          )}
        </div>
      )}

      {/* FAB button */}
      <button
        type="button"
        className={cn(
          "size-14 flex items-center justify-center rounded-full shadow-lg select-none touch-none",
          "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white",
          "transition-[box-shadow] duration-200",
          dragging.current ? "shadow-2xl cursor-grabbing" : "cursor-grab"
        )}
        style={{
          transition: dragging.current ? "none" : "box-shadow 0.2s",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleFabClick}
      >
        <MessageCircleQuestion className="size-6" />
      </button>
    </div>
  );
}
