"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, History, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "首页", icon: Home },
  { href: "/history", label: "知识历史", icon: History },
];

export function Sidebar() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <aside className="flex w-[220px] flex-col border-r bg-background">
        {/* Logo / Title */}
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <BookOpen className="size-5 text-primary" />
          <span className="text-base font-semibold">知识学习</span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <link.icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Settings button at bottom */}
        <div className="border-t p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2.5"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
            设置
          </Button>
        </div>
      </aside>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
