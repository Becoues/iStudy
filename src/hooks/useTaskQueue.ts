"use client";

import { useTaskStore } from "@/lib/task-store";

/** Convenience hook exposing task queue state and actions for components. */
export function useTaskQueue() {
  const tasks = useTaskStore((s) => s.tasks);
  const enqueue = useTaskStore((s) => s.enqueue);
  const cancel = useTaskStore((s) => s.cancel);
  const retry = useTaskStore((s) => s.retry);
  const clearCompleted = useTaskStore((s) => s.clearCompleted);

  const runningCount = tasks.filter((t) => t.status === "running").length;
  const queuedCount = tasks.filter((t) => t.status === "queued").length;

  return {
    tasks,
    enqueue,
    cancel,
    retry,
    clearCompleted,
    runningCount,
    queuedCount,
  };
}
