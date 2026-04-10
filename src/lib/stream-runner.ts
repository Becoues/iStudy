/**
 * Standalone SSE stream runner extracted from useStreamResponse.
 * Can be called from anywhere (not a React hook).
 *
 * SSE protocol:
 *   data: {"content": "..."}\n\n       — text chunk
 *   data: {"done": true, "fullContent": "..."}\n\n — completion
 *   data: {"error": "..."}\n\n        — server error
 */
export async function runStream(
  url: string,
  body: object,
  signal: AbortSignal,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      onError(new Error(`HTTP ${response.status}: ${errorText}`));
      return;
    }

    if (!response.body) {
      onError(new Error("Response body is empty"));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Stream ended without a done message; finalize with accumulated text
        onDone(accumulated);
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
            reader.cancel();
            onError(new Error(parsed.error));
            return;
          }

          if (parsed.done === true) {
            const finalText = parsed.fullContent || accumulated;
            reader.cancel();
            onDone(finalText);
            return;
          }

          // JSON with text/content field
          if (typeof parsed.text === "string") {
            accumulated += parsed.text;
            onChunk(accumulated);
            continue;
          }

          if (typeof parsed.content === "string") {
            accumulated += parsed.content;
            onChunk(accumulated);
            continue;
          }
        } catch {
          // Not JSON - treat as raw text chunk
          accumulated += dataContent;
          onChunk(accumulated);
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
    onError(new Error(message));
  }
}
