"use client";

import { useState, useCallback, useRef } from "react";
import type { KnowledgeItemData } from "@/types/knowledge";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface UseModuleChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => void;
  condense: () => Promise<KnowledgeItemData | null>;
  clear: () => void;
}

const STORAGE_KEY_PREFIX = "module-chat:";

function loadMessages(moduleId: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + moduleId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(moduleId: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY_PREFIX + moduleId,
      JSON.stringify(messages)
    );
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useModuleChat(
  moduleId: string,
  moduleContext?: {
    topic: string;
    items: Array<{ title: string; summary: string }>;
    focusedItem?: { title: string; summary: string; details: string };
  }
): UseModuleChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadMessages(moduleId)
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const persistMessages = useCallback(
    (msgs: ChatMessage[]) => {
      setMessages(msgs);
      saveMessages(moduleId, msgs);
    },
    [moduleId]
  );

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || isStreaming) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMsg];
      persistMessages(updatedMessages);

      // Start streaming assistant response
      setIsStreaming(true);
      setError(null);

      // Abort previous if any
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      // We need to track messages through the streaming in a ref-like way
      const allMessages = [...updatedMessages, assistantMsg];
      setMessages(allMessages);

      (async () => {
        try {
          const res = await fetch("/api/chat/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              moduleId,
              messages: updatedMessages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              context: moduleContext,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const errText = await res.text();
            setError(`HTTP ${res.status}: ${errText}`);
            setIsStreaming(false);
            // Remove the empty assistant message
            persistMessages(updatedMessages);
            return;
          }

          if (!res.body) {
            setError("Response body is empty");
            setIsStreaming(false);
            persistMessages(updatedMessages);
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              setIsStreaming(false);
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":")) continue;

              const dataContent = trimmed.startsWith("data: ")
                ? trimmed.slice(6)
                : trimmed;

              try {
                const parsed = JSON.parse(dataContent);

                if (parsed.error) {
                  setError(parsed.error);
                  setIsStreaming(false);
                  reader.cancel();
                  return;
                }

                if (parsed.done === true) {
                  const finalText = parsed.fullContent || accumulated;
                  const finalMsg = {
                    ...assistantMsg,
                    content: finalText,
                  };
                  const finalMessages = [...updatedMessages, finalMsg];
                  persistMessages(finalMessages);
                  setIsStreaming(false);
                  reader.cancel();
                  return;
                }

                if (typeof parsed.content === "string") {
                  accumulated += parsed.content;
                } else if (typeof parsed.text === "string") {
                  accumulated += parsed.text;
                }
              } catch {
                // Not JSON — raw text chunk
                accumulated += dataContent;
              }

              // Update the assistant message in-place
              setMessages((prev) => {
                const copy = [...prev];
                const lastIdx = copy.length - 1;
                if (lastIdx >= 0 && copy[lastIdx].role === "assistant") {
                  copy[lastIdx] = { ...copy[lastIdx], content: accumulated };
                }
                return copy;
              });
            }
          }

          // Final persist after stream ends without explicit done message
          setMessages((prev) => {
            const final = [...prev];
            saveMessages(moduleId, final);
            return final;
          });
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          const msg =
            err instanceof Error ? err.message : "Unknown stream error";
          setError(msg);
          setIsStreaming(false);
          persistMessages(updatedMessages);
        }
      })();
    },
    [messages, isStreaming, moduleId, moduleContext, persistMessages]
  );

  const condense = useCallback(async (): Promise<KnowledgeItemData | null> => {
    if (messages.length === 0) return null;

    try {
      const res = await fetch("/api/chat/condense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: moduleContext,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Condense failed: ${errText}`);
      }

      const data: KnowledgeItemData = await res.json();
      return data;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Condense failed";
      setError(msg);
      return null;
    }
  }, [messages, moduleId, moduleContext]);

  const clear = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    persistMessages([]);
    setIsStreaming(false);
    setError(null);
  }, [persistMessages]);

  return { messages, isStreaming, error, sendMessage, condense, clear };
}
