"use client";

import { useState, useCallback, useRef } from "react";

interface StreamState {
  streamText: string;
  isStreaming: boolean;
  error: string | null;
}

export function useStreamResponse() {
  const [state, setState] = useState<StreamState>({
    streamText: "",
    isStreaming: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState({
      streamText: "",
      isStreaming: false,
      error: null,
    });
  }, []);

  const startStream = useCallback(
    async (url: string, body: object) => {
      // Abort previous request if still running
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState({
        streamText: "",
        isStreaming: true,
        error: null,
      });

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: `HTTP ${response.status}: ${errorText}`,
          }));
          return;
        }

        if (!response.body) {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: "Response body is empty",
          }));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Stream ended without a done message; finalize
            setState((prev) => ({
              ...prev,
              isStreaming: false,
            }));
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines and SSE comments
            if (!trimmed || trimmed.startsWith(":")) continue;

            // Handle SSE data: prefix
            const dataContent = trimmed.startsWith("data: ")
              ? trimmed.slice(6)
              : trimmed;

            // Try to parse as JSON to detect control messages
            try {
              const parsed = JSON.parse(dataContent);

              if (parsed.error) {
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  error: parsed.error,
                }));
                reader.cancel();
                return;
              }

              if (parsed.done === true) {
                // Use fullContent if provided, otherwise keep accumulated text
                const finalText = parsed.fullContent || accumulated;
                setState({
                  streamText: finalText,
                  isStreaming: false,
                  error: null,
                });
                reader.cancel();
                return;
              }

              // If it parsed as JSON but is not a control message,
              // treat it as a text chunk if it has a text/content field
              if (typeof parsed.text === "string") {
                accumulated += parsed.text;
                setState((prev) => ({
                  ...prev,
                  streamText: accumulated,
                }));
                continue;
              }

              if (typeof parsed.content === "string") {
                accumulated += parsed.content;
                setState((prev) => ({
                  ...prev,
                  streamText: accumulated,
                }));
                continue;
              }
            } catch {
              // Not JSON - treat as raw text chunk
              accumulated += dataContent;
              setState((prev) => ({
                ...prev,
                streamText: accumulated,
              }));
            }
          }
        }
      } catch (err: unknown) {
        // Don't report abort errors
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        const message =
          err instanceof Error ? err.message : "Unknown stream error";
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: message,
        }));
      }
    },
    []
  );

  return {
    streamText: state.streamText,
    isStreaming: state.isStreaming,
    error: state.error,
    startStream,
    reset,
  };
}
