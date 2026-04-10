"use client";

import { useTaskStore } from "@/lib/task-store";

/** Per-item task status hook. Returns the active task (running or queued) for a target item. */
export function useTaskStatus(targetItemId: string | null) {
  const task = useTaskStore((s) =>
    targetItemId
      ? s.tasks.find(
          (t) =>
            t.targetItemId === targetItemId &&
            (t.status === "running" || t.status === "queued")
        ) ?? null
      : null
  );

  return {
    task,
    isRunning: task?.status === "running",
    isQueued: task?.status === "queued",
  };
}
