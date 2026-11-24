"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import type { Generation, Scene } from "@/lib/domain/schemas";
import { api, assetSrc } from "@/lib/client/api";
import { useResource } from "@/lib/client/resource";
import { cn } from "@/lib/utils";
import { useStudio } from "@/stores/studio";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTabs, type CreateTab } from "./tabs-store";
import type { StudioSession } from "./use-studio-session";

type TabView = CreateTab & { title: string; cover: string | null; generating: boolean; active: boolean };

/** Scenes that have an image generating right now, checked every few seconds. */
function useGeneratingScenes() {
  const [ids, setIds] = React.useState<string[]>([]);
  React.useEffect(() => {
    let alive = true;
    const tick = async () => {
      const res = await api<{ items: Generation[] }>("/api/generations?status=active&limit=50").catch(() => null);
      if (!alive || !res) return;
      const next = [...new Set(res.items.map((g) => g.sceneId).filter((x): x is string => !!x))].sort();
      setIds((cur) => (cur.join() === next.join() ? cur : next));
    };
    void tick();
    const t = setInterval(() => void tick(), 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return ids;
}

/** Titles, covers and progress for every open tab. */
function useTabViews(): TabView[] {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const startOpen = useStudio((s) => s.startOpen);
  const liveTitle = useStudio((s) => s.scene.title);
  const { data: scenes } = useResource<{ scenes: Scene[] }>("/api/scenes");
  const { data: gens } = useResource<{ items: Generation[] }>("/api/generations?status=completed&limit=100");
  const generating = useGeneratingScenes();

  const titleOf = new Map((scenes?.scenes ?? []).map((s) => [s.id, s.title]));
  const coverOf = new Map<string, string>();
  for (const g of gens?.items ?? []) if (g.sceneId && g.assetId && !coverOf.has(g.sceneId)) coverOf.set(g.sceneId, g.assetId);

  return tabs.map((t) => {
    const active = t.id === activeId;
    const title = active && !startOpen ? liveTitle || "Untitled scene" : t.sceneId ? (titleOf.get(t.sceneId) ?? "Untitled scene") : "New tab";
    return { ...t, active, title, cover: t.sceneId ? (coverOf.get(t.sceneId) ?? null) : null, generating: !!t.sceneId && generating.includes(t.sceneId) };
  });
}

function TabThumb({ tab, size = "sm" }: { tab: TabView; size?: "sm" | "lg" }) {
  return (
    <span className={cn("relative shrink-0 overflow-hidden rounded-[3px] bg-elevated", size === "sm" ? "size-[18px]" : "size-12 rounded-md")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {tab.cover ? <img src={assetSrc(tab.cover, "thumb")!} alt="" className="size-full object-cover" /> : null}
      {tab.generating ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="size-1.5 animate-pulse rounded-full bg-foreground" />
        </span>
      ) : null}
    </span>
  );
}

/** Desktop: a row of tabs above Create, like a browser. */
export function TabStrip({ session }: { session: StudioSession }) {
  const views = useTabViews();
  const listRef = React.useRef<HTMLDivElement>(null);
  const activeId = useTabs((s) => s.activeId);

  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  return (
    <div className="hidden h-10 shrink-0 items-end gap-1 border-b border-border px-2 md:flex">
      <div ref={listRef} role="tablist" aria-label="Open scenes" className="flex min-w-0 items-end gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {views.map((t) => (
          <div
            key={t.id}
            data-tab-id={t.id}
            className={cn(
              "group relative flex h-8 max-w-[220px] min-w-[120px] shrink-0 items-center rounded-t-md transition-colors",
              t.active ? "bg-surface text-foreground" : "text-text-muted hover:bg-surface/50 hover:text-text-secondary",
            )}
            onAuxClick={(e) => {
              if (e.button === 1) void session.closeTab(t.id);
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={t.active}
              onClick={() => void session.switchTab(t.id)}
              className="flex h-full min-w-0 flex-1 items-center gap-2 pr-1 pl-2.5 text-left text-[12.5px] outline-none focus-visible:ring-1 focus-visible:ring-text-secondary"
            >
              {t.sceneId ? <TabThumb tab={t} /> : null}
              <span className="truncate">{t.title}</span>
              {t.generating ? <span className="sr-only">, generating</span> : null}
            </button>
            <button
              type="button"
              aria-label={`Close ${t.title}`}
              onClick={() => void session.closeTab(t.id)}
              className={cn(
                "mr-1 flex size-5 shrink-0 items-center justify-center rounded-sm text-text-muted outline-none hover:bg-interactive hover:text-foreground focus-visible:opacity-100",
                t.active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="New tab"
            onClick={() => void session.newTab()}
            className="mb-1 flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>New tab</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Phone: a count button, like Safari's, that opens the list of tabs. */
export function TabSwitcherButton({ session, className }: { session: StudioSession; className?: string }) {
  const views = useTabViews();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Tabs, ${views.length} open`}
        className={cn("flex size-9 shrink-0 items-center justify-center", className)}
      >
        <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-[6px] border-[1.5px] border-text-secondary px-1 text-[12px] font-medium text-foreground tabular-nums">
          {views.length}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex flex-col gap-3 max-sm:inset-0 max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:pt-[calc(env(safe-area-inset-top)+16px)] max-sm:pb-[env(safe-area-inset-bottom)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-medium">Tabs</DialogTitle>
            <DialogDescription className="text-[12.5px]">Closing a tab keeps its scene in Recent and the Library.</DialogDescription>
          </DialogHeader>
          <ul className="-mx-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
            {views.map((t) => (
              <li key={t.id} className={cn("flex items-center gap-1 rounded-lg", t.active && "bg-surface")}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void session.switchTab(t.id);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left"
                >
                  {t.sceneId ? <TabThumb tab={t} size="lg" /> : <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-elevated text-text-muted"><Plus className="size-4" /></span>}
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] text-foreground">{t.title}</span>
                    <span className="block text-[12.5px] text-text-muted">{t.generating ? "Generating" : t.active ? "Open now" : t.sceneId ? "Scene" : "Start screen"}</span>
                  </span>
                </button>
                <button type="button" aria-label={`Close ${t.title}`} onClick={() => void session.closeTab(t.id)} className="flex size-10 shrink-0 items-center justify-center text-text-muted">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <Button
            onClick={() => {
              setOpen(false);
              void session.newTab();
            }}
          >
            <Plus /> New tab
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
