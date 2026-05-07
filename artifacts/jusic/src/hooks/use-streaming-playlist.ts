import { useState, useRef, useCallback } from "react";

export interface StreamingState {
  lines: string[];
  isStreaming: boolean;
  error: string | null;
}

export interface UseStreamingPlaylistReturn extends StreamingState {
  startStream: (prompt: string) => void;
  cancel: () => void;
  reset: () => void;
}

/**
 * Streams playlist suggestions from /api/gemini/playlist/stream using SSE,
 * so each suggested song appears word-by-word as Gemini generates it.
 */
export function useStreamingPlaylist(): UseStreamingPlaylistReturn {
  const [state, setState] = useState<StreamingState>({
    lines: [],
    isStreaming: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ lines: [], isStreaming: false, error: null });
  }, []);

  const startStream = useCallback((prompt: string) => {
    // Cancel any in-flight stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ lines: [], isStreaming: true, error: null });

    (async () => {
      try {
        const response = await fetch("/api/gemini/playlist/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let rawBuffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          rawBuffer += decoder.decode(value, { stream: true });

          // SSE events are delimited by double newlines
          const eventBlocks = rawBuffer.split("\n\n");
          rawBuffer = eventBlocks.pop() ?? "";

          for (const block of eventBlocks) {
            for (const rawLine of block.split("\n")) {
              if (!rawLine.startsWith("data:")) continue;

              const jsonStr = rawLine.slice("data:".length).trim();
              if (!jsonStr) continue;

              let parsed: Record<string, unknown>;
              try {
                parsed = JSON.parse(jsonStr) as Record<string, unknown>;
              } catch {
                continue;
              }

              if (parsed["error"]) {
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  error: String(parsed["error"]),
                }));
                return;
              }

              if (parsed["done"]) {
                setState((prev) => ({ ...prev, isStreaming: false }));
                return;
              }

              if (typeof parsed["line"] === "string") {
                setState((prev) => ({
                  ...prev,
                  lines: [...prev.lines, parsed["line"] as string],
                }));
              }
            }
          }
        }

        setState((prev) => ({ ...prev, isStreaming: false }));
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }));
      }
    })();
  }, []);

  return { ...state, startStream, cancel, reset };
}
