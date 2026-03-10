"use client";

import { useState } from "react";
import { ChevronDown, Lightbulb, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Quiz {
  question: string;
  options: string[];
  hint: string;
  answer: string; // e.g. "A", "B", "C", "D"
  explanation: string;
}

interface QuizSectionProps {
  quiz?: Quiz | null;
}

export function QuizSection({ quiz }: QuizSectionProps) {
  if (!quiz) return null;
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  // Convert answer letter (e.g. "A") to index (0)
  const answerIndex = quiz.answer ? quiz.answer.charCodeAt(0) - 65 : 0;
  const isCorrect = selectedOption !== null && selectedOption === answerIndex;
  const isWrong =
    selectedOption !== null && showAnswer && selectedOption !== answerIndex;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-background">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="shrink-0">
              小测验
            </Badge>
            <span className="text-sm font-medium">{quiz.question}</span>
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="flex flex-col gap-3 border-t px-4 py-3">
            {/* Options */}
            <div className="flex flex-col gap-2">
              {quiz.options.map((option, index) => {
                const isSelected = selectedOption === index;
                const showResult = showAnswer && isSelected;
                const isOptionCorrect = index === answerIndex;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      if (!showAnswer) {
                        setSelectedOption(index);
                      }
                    }}
                    disabled={showAnswer}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      isSelected && !showAnswer && "border-primary bg-primary/5",
                      showAnswer && isOptionCorrect && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
                      showResult && !isOptionCorrect && "border-destructive bg-destructive/5",
                      !isSelected && !showAnswer && "hover:bg-muted/50",
                      showAnswer && "cursor-default"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border text-xs",
                        isSelected && !showAnswer && "border-primary bg-primary text-primary-foreground",
                        showAnswer && isOptionCorrect && "border-emerald-500 bg-emerald-500 text-white",
                        showResult && !isOptionCorrect && "border-destructive bg-destructive text-white",
                        !isSelected && !showAnswer && "text-muted-foreground"
                      )}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {showAnswer && isOptionCorrect && (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    )}
                    {showResult && !isOptionCorrect && (
                      <XCircle className="size-4 shrink-0 text-destructive" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHint(!showHint)}
              >
                <Lightbulb className="size-3.5" />
                {showHint ? "隐藏提示" : "显示提示"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAnswer(true)}
                disabled={showAnswer}
              >
                查看答案
              </Button>
            </div>

            {/* Hint */}
            {showHint && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                <span className="font-medium">提示：</span>
                {quiz.hint}
              </div>
            )}

            {/* Answer explanation */}
            {showAnswer && (
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  isCorrect
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "bg-muted text-foreground"
                )}
              >
                {isCorrect && (
                  <p className="mb-1 font-medium text-emerald-700 dark:text-emerald-400">
                    回答正确！
                  </p>
                )}
                {isWrong && (
                  <p className="mb-1 font-medium text-destructive">
                    回答错误
                  </p>
                )}
                <p>
                  <span className="font-medium">解析：</span>
                  {quiz.explanation}
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
