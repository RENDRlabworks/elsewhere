"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MotionConfig } from "motion/react";
import { ChevronsLeft, ChevronsRight, Command as CommandIcon, Inbox, LayoutGrid, LogOut, Plus, RefreshCw, Search, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client/api";
import { useApp } from "@/stores/app";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmHost } from "@/components/common/confirm";
import { CollectionPicker } from "@/components/generation/collection-picker";
import { StyleReferencePicker } from "@/components/generation/style-reference-picker";
import { ShareSheet } from "@/components/share/share-sheet";
import { CaptureDialog, useCapture } from "@/components/inbox/capture";
import { useResource } from "@/lib/client/resource";
import { CommandPalette } from "./command-palette";
import { isActive, PRIMARY_NAV } from "./nav";

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
      if (e.key === "n" && !document.querySelector("[role=dialog]")) {
        e.preventDefault();
        useCapture.getState().show();
        return;
      }
      if (e.key === "g") {
        leader = Date.now();
        return;
      }
      if (Date.now() - leader < 900) {
        const map: Record<string, string> = { c: "/studio", s: "/studio", l: "/archive", a: "/archive", i: "/inbox", r: "/archive/review", e: "/explore", d: "/style-dna", ",": "/settings" };
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

function NavLink({ href, label, icon: Icon, active, collapsed, count }: { href: string; label: string; icon: typeof Settings; active: boolean; collapsed: boolean; count?: number | null }) {
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-lg text-[14px] transition-colors",
        collapsed ? "justify-center" : "px-3",
        active ? "bg-interactive text-foreground" : "text-text-secondary hover:bg-surface hover:text-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.5} />
      {!collapsed ? <span className="flex-1">{label}</span> : null}
      {!collapsed && count ? <span className="text-[12px] text-text-muted tabular-nums">{count}</span> : null}
    </Link>
  );
  return collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  ) : (
    link
  );
}

function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const setCollapsed = useUi((s) => s.setSidebarCollapsed);
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  const data = useApp((s) => s.data);
  const updatePreferences = useApp((s) => s.updatePreferences);
  const inboxCount = useInboxCount();

  const toggle = () => {
    setCollapsed(!collapsed);
    void updatePreferences({ ui: { sidebarCollapsed: !collapsed } }).catch(() => {});
  };

  return (
    <nav
      aria-label="Primary"
      className={cn("hidden h-full shrink-0 flex-col bg-background transition-[width] duration-200 md:flex", collapsed ? "w-[60px]" : "w-[196px]")}
    >
      <div className={cn("flex h-14 items-center", collapsed ? "justify-center" : "px-5")}>
        <Link href="/studio" aria-label="Elsewhere" className="text-[13px] font-medium tracking-[0.22em] text-foreground uppercase">
          {collapsed ? "E" : "Elsewhere"}
        </Link>
      </div>

      <ul className="space-y-1 px-2.5 pt-2">
        {PRIMARY_NAV.map((item) => (
          <li key={item.href}>
            <NavLink href={item.href} label={item.label} icon={item.icon} active={isActive(item, pathname)} collapsed={collapsed} />
          </li>
        ))}
        <li>
          <NavLink href="/inbox" label="Inbox" icon={Inbox} active={pathname.startsWith("/inbox")} collapsed={collapsed} count={inboxCount} />
        </li>
      </ul>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className={cn(
          "mx-2.5 mt-4 flex h-9 items-center gap-3 rounded-lg text-[13px] text-text-muted transition-colors hover:bg-surface hover:text-text-secondary",
          collapsed ? "justify-center px-0" : "px-3",
        )}
        aria-label="Open command palette"
      >
        <CommandIcon className="size-4" strokeWidth={1.5} />
        {!collapsed ? (
          <>
            <span className="flex-1 text-left">Search or jump</span>
            <span className="font-mono text-[11px]">⌘K</span>
          </>
        ) : null}
      </button>

      <div className="flex-1" />

      <div className={cn("space-y-1 px-2.5 pb-3", collapsed && "flex flex-col items-center")}>
        <NavLink href="/settings" label="Settings" icon={Settings} active={pathname.startsWith("/settings")} collapsed={collapsed} />
        <div className={cn("flex items-center pt-1", collapsed ? "flex-col gap-1" : "justify-between pl-1")}>
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
                    // Full navigation so no signed-in client state survives sign-out.
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    location.href = "/login";
                  }}
                >
                  <LogOut />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out {data.user.email}</TooltipContent>
            </Tooltip>
          ) : data && !data.runtime.openaiConfigured ? (
            <Link href="/settings#integrations" className="flex items-center gap-1.5 text-[11.5px] text-text-muted hover:text-text-secondary" title="Sketches only. Configure OpenAI for real images.">
              <span className="size-1.5 rounded-full bg-warning" />
              {!collapsed ? "Dev mode" : null}
            </Link>
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

function useInboxCount() {
  const { data } = useResource<{ count: number | null }>("/api/inbox/count");
  return data?.count ?? null;
}

/** Phone navigation: the places a thumb needs, with capture in the middle. */
function TabBar() {
  const pathname = usePathname();
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  const showCapture = useCapture((s) => s.show);
  const inboxCount = useInboxCount();
  const tab = (href: string, label: string, Icon: typeof Settings, active: boolean, count?: number | null) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px]", active ? "text-foreground" : "text-text-muted")}
    >
      <Icon className="size-[22px]" strokeWidth={1.5} />
      {label}
      {count ? (
        <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-foreground px-1 text-center text-[10px] leading-4 font-medium text-background tabular-nums">{count > 99 ? "99+" : count}</span>
      ) : null}
    </Link>
  );
  return (
    <nav aria-label="Primary" className="flex shrink-0 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="flex h-14 w-full items-stretch">
        {tab("/studio", "Create", Sparkles, ["/studio", "/explore", "/style-dna"].some((p) => pathname.startsWith(p)))}
        {tab("/archive", "Library", LayoutGrid, pathname.startsWith("/archive") || pathname.startsWith("/collections"))}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={showCapture}
            aria-label="Capture an idea"
            className="flex size-11 items-center justify-center rounded-full bg-foreground text-background active:scale-95"
          >
            <Plus className="size-5" />
          </button>
        </div>
        {tab("/inbox", "Inbox", Inbox, pathname.startsWith("/inbox"), inboxCount)}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] text-text-muted"
        >
          <Search className="size-[22px]" strokeWidth={1.5} />
          Search
        </button>
      </div>
    </nav>
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
      <div className="flex h-dvh flex-col md:flex-row">
        {!fullscreen ? (
          <React.Suspense fallback={<div className="hidden h-full w-[196px] shrink-0 bg-background md:block" />}>
            <Sidebar />
          </React.Suspense>
        ) : null}
        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden pt-[env(safe-area-inset-top)] md:pt-0">
          <BootGate>{children}</BootGate>
        </main>
        {!fullscreen ? (
          <React.Suspense fallback={null}>
            <TabBar />
          </React.Suspense>
        ) : null}
      </div>
      <CommandPalette />
      <CollectionPicker />
      <StyleReferencePicker />
      <ShareSheet />
      <CaptureDialog />
      <ConfirmHost />
    </MotionConfig>
  );
}
