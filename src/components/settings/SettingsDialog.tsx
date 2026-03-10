"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FeedbackType = "success" | "error" | null;

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: FeedbackType;
    message: string;
  } | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.apiKey) setApiKey(data.apiKey);
        if (data.model) setModel(data.model);
      }
    } catch {
      // Settings may not exist yet
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadSettings();
      setFeedback(null);
      setShowKey(false);
    }
  }, [open, loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model }),
      });
      if (res.ok) {
        setFeedback({ type: "success", message: "设置已保存" });
      } else {
        setFeedback({ type: "error", message: "保存失败，请重试" });
      }
    } catch {
      setFeedback({ type: "error", message: "网络错误，请检查连接" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        setFeedback({ type: "success", message: "连接测试成功" });
      } else {
        setFeedback({ type: "error", message: "连接测试失败" });
      }
    } catch {
      setFeedback({ type: "error", message: "网络错误，无法连接" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>配置 API 连接参数</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="settings-api-key"
              className="text-sm font-medium text-foreground"
            >
              API 密钥
            </label>
            <div className="relative">
              <Input
                id="settings-api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="pr-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Model */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="settings-model"
              className="text-sm font-medium text-foreground"
            >
              模型
            </label>
            <Input
              id="settings-model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o"
            />
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              {feedback.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || saving}
          >
            {testing && <Loader2 className="size-4 animate-spin" />}
            测试连接
          </Button>
          <Button onClick={handleSave} disabled={saving || testing}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
