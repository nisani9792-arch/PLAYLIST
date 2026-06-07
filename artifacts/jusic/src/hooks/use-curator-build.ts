import { useState, useRef, useCallback } from 'react';

export type CuratorStreamStage = 'vibe' | 'progress' | 'song' | 'done' | 'error';

export interface CuratorStreamingState {
  lines: string[];
  isStreaming: boolean;
  error: string | null;
  stage: CuratorStreamStage | null;
  vibe: string | null;
  progress: { found?: number; targetSize?: number; message?: string } | null;
}

export function useCuratorStream(): CuratorStreamingState & {
  startStream: (prompt: string, targetSize?: number) => void;
  cancel: () => void;
  reset: () => void;
} {
  const [state, setState] = useState<CuratorStreamingState>({
    lines: [],
    isStreaming: false,
    error: null,
    stage: null,
    vibe: null,
    progress: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({
      lines: [],
      isStreaming: false,
      error: null,
      stage: null,
      vibe: null,
      progress: null,
    });
  }, []);

  const startStream = useCallback((prompt: string, targetSize?: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      lines: [],
      isStreaming: true,
      error: null,
      stage: null,
      vibe: null,
      progress: null,
    });

    void (async () => {
      try {
        const response = await fetch('/api/curator/build/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, targetSize }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let rawBuffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          rawBuffer += decoder.decode(value, { stream: true });
          const eventBlocks = rawBuffer.split('\n\n');
          rawBuffer = eventBlocks.pop() ?? '';

          for (const block of eventBlocks) {
            for (const rawLine of block.split('\n')) {
              if (!rawLine.startsWith('data:')) continue;
              const jsonStr = rawLine.slice('data:'.length).trim();
              if (!jsonStr) continue;

              let parsed: Record<string, unknown>;
              try {
                parsed = JSON.parse(jsonStr) as Record<string, unknown>;
              } catch {
                continue;
              }

              const stage = String(parsed.stage ?? '');

              if (stage === 'error') {
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  stage: 'error',
                  error: String(parsed.error ?? 'Unknown error'),
                }));
                return;
              }

              if (stage === 'vibe') {
                setState((prev) => ({
                  ...prev,
                  stage: 'vibe',
                  vibe: String((parsed.vibe as Record<string, unknown>)?.mood ?? parsed.vibe ?? ''),
                }));
              }

              if (stage === 'progress') {
                setState((prev) => ({
                  ...prev,
                  stage: 'progress',
                  progress: {
                    found: typeof parsed.found === 'number' ? parsed.found : undefined,
                    targetSize: typeof parsed.targetSize === 'number' ? parsed.targetSize : undefined,
                    message: typeof parsed.message === 'string' ? parsed.message : undefined,
                  },
                }));
              }

              if (stage === 'song' && typeof parsed.line === 'string') {
                setState((prev) => ({
                  ...prev,
                  stage: 'song',
                  lines: [...prev.lines, parsed.line as string],
                }));
              }

              if (stage === 'done') {
                setState((prev) => ({ ...prev, isStreaming: false, stage: 'done' }));
                return;
              }
            }
          }
        }

        setState((prev) => ({ ...prev, isStreaming: false, stage: 'done' }));
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          stage: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    })();
  }, []);

  return { ...state, startStream, cancel, reset };
}

export async function buildCuratorPlaylist(input: {
  prompt: string;
  targetSize?: number;
  mode?: 'topic' | 'parasha' | 'list';
}): Promise<{ lines: string[]; meta?: { vibe?: string; targetSize?: number; reason?: string } }> {
  const res = await fetch('/api/curator/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Curator error ${res.status}`);
  }
  return (await res.json()) as { lines: string[]; meta?: { vibe?: string; targetSize?: number; reason?: string } };
}

export type RefinementTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export async function refineCuratorPlaylist(input: {
  originalPrompt: string;
  refinement: string;
  currentLines: string[];
  conversationHistory?: RefinementTurn[];
  targetSize?: number;
}): Promise<{
  lines: string[];
  meta?: { vibe?: string; targetSize?: number; reason?: string };
}> {
  const res = await fetch('/api/curator/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Refine error ${res.status}`);
  }
  return (await res.json()) as {
    lines: string[];
    meta?: { vibe?: string; targetSize?: number; reason?: string };
  };
}

export async function fillCuratorPlaylist(input: {
  topic: string;
  targetSize?: number;
  existingLines: string[];
}): Promise<{
  lines: string[];
  meta?: { vibe?: string; targetSize?: number; reason?: string };
}> {
  const res = await fetch('/api/curator/fill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Fill failed');
  return (await res.json()) as {
    lines: string[];
    meta?: { vibe?: string; targetSize?: number; reason?: string };
  };
}
