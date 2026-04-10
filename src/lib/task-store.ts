"use client";

import { create } from "zustand";
import { runStream } from "@/lib/stream-runner";

export interface TaskItem {
  id: string;
  type: "generate" | "expand" | "followup" | "image";
  status: "queued" | "running" | "completed" | "failed";
  label: string;
  payload: Record<string, unknown>;
  result: string | null;
  error: string | null;
  bytesReceived: number;
  startedAt: number | null;
  targetItemId: string | null;
  moduleId: string | null;
  abortController: AbortController | null;
}

/** Fields the caller provides when enqueuing a task. */
export type EnqueuePayload = Omit<
  TaskItem,
  "id" | "status" | "result" | "error" | "bytesReceived" | "startedAt" | "abortController"
>;

/** URL mapping per task type. Callers can override via payload.url. */
const URL_MAP: Record<TaskItem["type"], string> = {
  generate: "/api/knowledge/generate",
  expand: "/api/knowledge/expand",
  followup: "/api/knowledge/expand",
  image: "/api/knowledge/generate-image",
};

let idCounter = 0;
function nextId(): string {
  return `task-${Date.now()}-${++idCounter}`;
}

export interface TaskStore {
  tasks: TaskItem[];
  maxConcurrency: number;

  enqueue: (task: EnqueuePayload) => string;
  cancel: (taskId: string) => void;
  retry: (taskId: string) => void;
  clearCompleted: () => void;
  getRunningCount: () => number;
  getQueuedTasks: () => TaskItem[];
  getTaskByTargetItem: (itemId: string) => TaskItem | undefined;

  /** Internal dispatcher — starts queued tasks when slots are available. */
  _dispatch: () => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  maxConcurrency: 2,

  enqueue(incoming) {
    const id = nextId();
    const task: TaskItem = {
      ...incoming,
      id,
      status: "queued",
      result: null,
      error: null,
      bytesReceived: 0,
      startedAt: null,
      abortController: null,
    };

    set((s) => ({ tasks: [...s.tasks, task] }));

    // Defer dispatch so the state update settles first
    queueMicrotask(() => get()._dispatch());

    return id;
  },

  cancel(taskId) {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.abortController) {
      task.abortController.abort();
    }

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: "failed" as const, error: "Cancelled", abortController: null }
          : t
      ),
    }));

    queueMicrotask(() => get()._dispatch());
  },

  retry(taskId) {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task || task.status !== "failed") return;

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: "queued" as const, result: null, error: null, bytesReceived: 0, startedAt: null, abortController: null }
          : t
      ),
    }));

    queueMicrotask(() => get()._dispatch());
  },

  clearCompleted() {
    set((s) => ({
      tasks: s.tasks.filter(
        (t) => t.status !== "completed" && t.status !== "failed"
      ),
    }));
  },

  getRunningCount() {
    return get().tasks.filter((t) => t.status === "running").length;
  },

  getQueuedTasks() {
    return get().tasks.filter((t) => t.status === "queued");
  },

  getTaskByTargetItem(itemId) {
    return get().tasks.find(
      (t) =>
        t.targetItemId === itemId &&
        (t.status === "running" || t.status === "queued")
    );
  },

  _dispatch() {
    const { tasks, maxConcurrency } = get();
    const running = tasks.filter((t) => t.status === "running").length;
    const queued = tasks.filter((t) => t.status === "queued");

    const slotsAvailable = maxConcurrency - running;
    if (slotsAvailable <= 0 || queued.length === 0) return;

    const toStart = queued.slice(0, slotsAvailable);

    for (const task of toStart) {
      const controller = new AbortController();
      const url =
        (task.payload.url as string | undefined) ?? URL_MAP[task.type];

      // Mark as running with abort controller
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === task.id
            ? { ...t, status: "running" as const, startedAt: Date.now(), abortController: controller }
            : t
        ),
      }));

      // Build the request body — strip out the internal 'url' field from payload
      const { url: _omit, ...requestBody } = task.payload;
      void _omit; // unused

      runStream(
        url,
        requestBody,
        controller.signal,
        // onChunk
        (accumulated) => {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === task.id
                ? { ...t, result: accumulated, bytesReceived: new Blob([accumulated]).size }
                : t
            ),
          }));
        },
        // onDone
        (fullText) => {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === task.id
                ? { ...t, status: "completed" as const, result: fullText, abortController: null }
                : t
            ),
          }));
          queueMicrotask(() => get()._dispatch());
        },
        // onError
        (error) => {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === task.id
                ? { ...t, status: "failed" as const, error: error.message, abortController: null }
                : t
            ),
          }));
          queueMicrotask(() => get()._dispatch());
        }
      );
    }
  },
}));
