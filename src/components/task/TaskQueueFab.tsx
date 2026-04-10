"use client";

import { useState } from "react";
import { ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskQueue } from "@/hooks/useTaskQueue";
import { TaskQueuePanel } from "@/components/task/TaskQueuePanel";

/**
 * Small floating action button (bottom-right) showing task queue status.
 * Hidden when no tasks exist. Click toggles TaskQueuePanel.
 */
export function TaskQueueFab() {
  const [panelOpen, setPanelOpen] = useState(false);
  const { tasks, runningCount, queuedCount } = useTaskQueue();

  const activeCount = runningCount + queuedCount;
  const totalVisible = tasks.length;

  // Hide entirely when no tasks
  if (totalVisible === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Panel — positioned above the FAB */}
      {panelOpen && (
        <TaskQueuePanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {/* FAB button */}
      <button
        type="button"
        onClick={() => setPanelOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3.5 py-2 shadow-lg",
          "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white",
          "text-sm font-medium transition-all select-none",
          activeCount > 0 && "animate-pulse"
        )}
      >
        <ListTodo className="size-4" />
        <span className="tabular-nums">
          {activeCount > 0
            ? `${runningCount}/${runningCount + queuedCount}`
            : `${totalVisible}`}
        </span>
        {activeCount > 0 && <span className="text-xs opacity-80">&#9654;</span>}
      </button>
    </div>
  );
}
