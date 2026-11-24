"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MotionConfig } from "motion/react";
import { ChevronsLeft, ChevronsRight, Command as CommandIcon, LogOut, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client/api";
import { useApp } from "@/stores/app";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmHost } from "@/components/common/confirm";
import { CollectionPicker } from "@/components/generation/collection-picker";
import { CommandPalette } from "./command-palette";
import { NAV } from "./nav";

function useGlobalShortcuts() {
  const router = useRouter();
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  React.useEffect(() => {
    let leader = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!useUi.getState().commandOpen);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "g") {
        leader = Date.now();
        return;
      }
      if (Date.now() - leader < 900) {
        const map: Record<string, string> = { s: "/studio", e: "/explore", d: "/style-dna", c: "/collections", a: "/archive", ",": "/settings" };
        if (map[e.key]) {
          e.preventDefault();
          router.push(map[e.key]);
        }
        leader = 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, setCommandOpen]);
}

function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const setCollapsed = useUi((s) => s.setSidebarCollapsed);
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  const data = useApp((s) => s.data);
  const updatePreferences = useApp((s) => s.updatePreferences);

  const toggle = () => {
    setCollapsed(!collapsed);
    void updatePreferences({ ui: { sidebarCollapsed: !collapsed } }).catch(() => {});
  };

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200",
        collapsed ? "w-[52px]" : "w-[208px]",
      )}
    >
      <div className={cn("flex h-12 items-center", collapsed ? "justify-center" : "justify-between px-4")}>
        {!collapsed ? (
          <Link href="/studio" className="text-[13px] font-medium tracking-[0.18em] text-foreground uppercase">
            Elsewhere
          </Link>
        ) : (
          <Link href="/studio" aria-label="Elsewhere" className="text-[13px] font-medium text-foreground">
            E
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className={cn(
          "mx-2 mb-3 flex h-7 items-center gap-2 rounded-md border border-border bg-surface text-[12px] text-text-muted transition-colors hover:text-text-secondary",
          collapsed ? "justify-center px-0" : "px-2",
        )}
        aria-label="Open command palette"
      >
        <CommandIcon className="size-3.5" />
        {!collapsed ? (
          <>
            <span className="flex-1 text-left">Search or jump</span>
            <span className="font-mono text-[10.5px]">⌘K</span>
          </>
        ) : null}
      </button>

      <ul className="flex-1 space-y-0.5 px-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const link = (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md text-[13px] transition-colors",
                collapsed ? "justify-center" : "px-2.5",
                active ? "bg-interactive text-foreground" : "text-text-secondary hover:bg-surface hover:text-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" strokeWidth={1.6} />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
          return (
            <li key={item.href}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>

      <div className={cn("space-y-2 border-t border-border p-2", collapsed && "flex flex-col items-center")}>
        {data && !collapsed ? <ModeBadge /> : null}
        <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "justify-between")}>
          {data?.user.mode === "supabase" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Sign out"
                  className="text-text-muted"
                  onClick={async () => {
                    await api("/api/auth/signout", { method: "POST" });
                    location.href = "/login";
                  }}
                >
                  <LogOut />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out {data.user.email}</TooltipContent>
            </Tooltip>
          ) : (
            <span />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="text-text-muted">
                {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? "Expand" : "Collapse"} sidebar</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </nav>
  );
}

function ModeBadge() {
  const data = useApp((s) => s.data)!;
  const live = data.runtime.openaiConfigured;
  return (
    <Link href="/settings#integrations" className="block rounded-md border border-border px-2.5 py-2 hover:bg-surface">
      <div className="flex items-center gap-1.5 text-[11.5px] text-text-secondary">
        <span className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-warning")} />
        {live ? "Live generation" : "Development mode"}
      </div>
      <div className="mt-0.5 text-[11px] text-text-muted">
        {data.runtime.dataMode === "local" ? "Local storage" : "Supabase"}
        {live ? "" : " · sketches only"}
      </div>
    </Link>
  );
}

function BootGate({ children }: { children: React.ReactNode }) {
  const { status, error, load, data } = useApp();
  const setCollapsed = useUi((s) => s.setSidebarCollapsed);
  React.useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);
  React.useEffect(() => {
    if (!data) return;
    setCollapsed(data.preferences.ui.sidebarCollapsed);
    document.documentElement.dataset.theme = data.preferences.ui.theme;
    document.documentElement.dataset.reduceMotion = String(data.preferences.ui.reduceMotion);
  }, [data, setCollapsed]);

  if (status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="text-[13px]">Elsewhere could not start</div>
        <div className="max-w-md text-[12.5px] text-text-muted">{error}</div>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCw /> Retry
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-full gap-4 p-6" aria-busy="true" aria-label="Loading workspace">
        <Skeleton className="h-full w-72" />
        <Skeleton className="h-full flex-1" />
        <Skeleton className="h-full w-72" />
      </div>
    );
  }
  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useGlobalShortcuts();
  const reduceMotion = useApp((s) => s.data?.preferences.ui.reduceMotion);
  const fullscreen = useUi((s) => s.fullscreen);
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <div className="flex h-full">
        {!fullscreen ? <Sidebar /> : null}
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <BootGate>{children}</BootGate>
        </main>
      </div>
      <CommandPalette />
      <CollectionPicker />
      <ConfirmHost />
    </MotionConfig>
  );
}
