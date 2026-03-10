import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Difficulty = "basic" | "intermediate" | "advanced";

interface DifficultyBadgeProps {
  difficulty: Difficulty;
  className?: string;
}

const difficultyConfig: Record<
  Difficulty,
  { label: string; className: string }
> = {
  basic: {
    label: "基础",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  intermediate: {
    label: "进阶",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  },
  advanced: {
    label: "高级",
    className:
      "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  },
};

export function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  const config = difficultyConfig[difficulty] ?? difficultyConfig.basic;

  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
