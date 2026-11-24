"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Bookmark, BookmarkCheck, Compass, Dices, Layers, LayoutGrid, Loader2, Shuffle, Sparkles, X } from "lucide-react";
import type { Scene } from "@/lib/domain/schemas";
import { conceptToScene, type ConceptMode } from "@/lib/explore/engine";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate } from "@/lib/client/resource";
import { useApp, usePreferences, useProfiles } from "@/stores/app";
import { cn } from "@/lib/utils";
import { MetaLabel, PageHeader } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConceptCard, ConceptCardSkeleton, ConceptTile } from "./concept-card";
import { SAVED_KEY, SavedConcepts } from "./saved-concepts";
import { useExplore, type ConceptEntry } from "./store";

const NONE = "__none";

function ActionButton({
  mode,
  label,
  icon: Icon,
  shortcut,
  hint,
  onRun,
  pending,
  disabled,
  primary,
}: {
  mode: ConceptMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  hint: string;
  onRun: (m: ConceptMode) => void;
  pending: ConceptMode | null;
  disabled?: boolean;
  primary?: boolean;
}) {
  const busy = pending === mode;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={primary ? "default" : "secondary"}
          disabled={disabled || !!pending}
          onClick={() => onRun(mode)}
          className="text-[12.5px]"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Icon />}
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex max-w-64 items-center gap-2">
        {hint}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function ExploreView() {
  const router = useRouter();
  const prefs = usePreferences();
  const profiles = useProfiles();
  const textAssist = useApp((s) => s.data?.textAssist);
  const aiAvailable = !!textAssist?.available;

  const current = useExplore((s) => s.current);
  const history = useExplore((s) => s.history);
  const batch = useExplore((s) => s.batch);
  const locked = useExplore((s) => s.locked);
  const pending = useExplore((s) => s.pending);
  const useAi = useExplore((s) => s.useAi);
  const savedMap = useExplore((s) => s.saved);
  const styleOverride = useExplore((s) => s.styleProfileId);
  const { setCurrent, toggleLock, clearLocks, setUseAi, setStyleProfileId, dismissBatch, markSaved } = useExplore.getState();

  const activeProfiles = profiles.filter((p) => !p.archived);
  const fallbackId = prefs?.activeStyleProfileId ?? null;
  const styleProfileId = styleOverride === undefined ? fallbackId : styleOverride;
  const validStyleId = styleProfileId && activeProfiles.some((p) => p.id === styleProfileId) ? styleProfileId : null;

  const [busy, setBusy] = React.useState<"save" | "studio" | null>(null);
  const lockedCount = Object.keys(locked).length;
  const savedSceneId = current ? savedMap[current.id] : undefined;
  const isSaved = !!savedSceneId || current?.source.kind === "saved";

  const go = React.useCallback((mode: ConceptMode) => void useExplore.getState().run(mode, { styleProfileId: validStyleId }), [validStyleId]);

  // Intentional first run: open with a concept rather than an empty page.
  React.useEffect(() => {
    const s = useExplore.getState();
    if (!s.current && !s.pending) void s.run("randomize-all", { styleProfileId: validStyleId });
    // Only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: R randomize unlocked, Shift+R randomize everything, S surprise.
  React.useEffect(() => {
    let leader = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      if (typing || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (document.querySelector("[role=dialog], [role=alertdialog], [role=listbox], [role=menu]")) return;
      if (e.key === "g") {
        leader = Date.now();
        return;
      }
      // "g" then a letter is global navigation; do not also act on it here.
      if (Date.now() - leader < 900) {
        leader = 0;
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "r") {
        e.preventDefault();
        go(e.shiftKey ? "randomize-all" : "randomize-unlocked");
      } else if (k === "s" && !e.shiftKey) {
        e.preventDefault();
        go("surprise");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  async function persist(status: "concept" | "draft"): Promise<Scene> {
    if (!current) throw new Error("No concept selected");
    const { scene } = await api<{ scene: Scene }>("/api/scenes", {
      method: "POST",
      body: { ...conceptToScene(current.concept), styleProfileId: validStyleId, status, origin: "explore" },
    });
    return scene;
  }

  async function save() {
    if (!current || isSaved) return;
    setBusy("save");
    try {
      const scene = await persist("concept");
      markSaved(current.id, scene.id);
      invalidate(SAVED_KEY);
      toast.success("Concept saved", { description: scene.title });
    } catch (err) {
      toast.error("Could not save the concept", { description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  async function sendToStudio() {
    if (!current) return;
    setBusy("studio");
    try {
      const scene = await persist("draft");
      invalidate("/api/scenes");
      router.push(`/studio?scene=${scene.id}`);
    } catch (err) {
      toast.error("Could not open the concept in Create", { description: errorMessage(err) });
      setBusy(null);
    }
  }

  function pick(entry: ConceptEntry) {
    setCurrent(entry);
    dismissBatch();
  }

  const noBase = !current;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Ideas"
        description="Discover scene concepts without generating images. Lock what is working, reshuffle the rest, then direct it in Create."
        actions={
          <>
            <div className="flex items-center gap-2">
              <Label htmlFor="explore-style" className="text-[12.5px] font-normal text-text-secondary">
                Look
              </Label>
              <Select value={validStyleId ?? NONE} onValueChange={(v) => setStyleProfileId(v === NONE ? null : v)}>
                <SelectTrigger id="explore-style" size="sm" className="h-7 w-52 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end" position="popper">
                  {activeProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-[12.5px]">
                      {p.name}
                      {p.id === fallbackId ? <span className="text-text-muted">Active</span> : null}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={NONE} className="text-[12.5px]">
                    No look
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-3 flex items-center gap-2 border-l border-border pl-4">
              <Switch id="explore-ai" size="sm" checked={useAi && aiAvailable} disabled={!aiAvailable} onCheckedChange={setUseAi} />
              <Label htmlFor="explore-ai" className={cn("text-[12px] font-normal", aiAvailable ? "text-text-secondary" : "text-text-muted")}>
                Use AI
              </Label>
            </div>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1120px] space-y-6 px-8 py-6">
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                primary
                mode="randomize-unlocked"
                label="Shuffle"
                icon={Shuffle}
                shortcut="R"
                hint="Keep locked variables and reinvent the rest."
                onRun={go}
                pending={pending}
              />
              <ActionButton mode="surprise" label="Surprise me" icon={Sparkles} shortcut="S" hint="Favour rare characters, phenomena and compositions." onRun={go} pending={pending} />
              <ActionButton mode="batch" label="Five ideas" icon={LayoutGrid} hint="Five distinct concepts to choose from. Locks are respected." onRun={go} pending={pending} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="ghost" className="text-text-secondary" disabled={!!pending}>
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onSelect={() => go("randomize-all")}>
                    <Dices /> Start fresh <span className="ml-auto font-mono text-[11px] text-text-muted">⇧R</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={noBase} onSelect={() => go("similar")}>
                    <Layers /> More like this
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={noBase} onSelect={() => go("new-direction")}>
                    <Compass /> New direction
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {batch ? (
              <section aria-label="Five concepts" className="space-y-3">
                <div className="flex items-center justify-between">
                  <MetaLabel>Choose a concept</MetaLabel>
                  <Button variant="ghost" size="xs" className="text-text-muted" onClick={dismissBatch}>
                    <X /> Dismiss
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
                  {batch.map((entry, i) => (
                    <ConceptTile key={entry.id} concept={entry.concept} index={i} onSelect={() => pick(entry)} />
                  ))}
                </div>
              </section>
            ) : null}

            {current ? (
              <ConceptCard
                concept={current.concept}
                source={current.source}
                entryKey={current.id}
                locked={locked}
                onToggleLock={toggleLock}
                busy={!!pending && pending !== "batch"}
                footer={
                  <>
                    <div className="text-[12px] text-text-muted">
                      {lockedCount ? (
                        <>
                          {lockedCount} locked{" "}
                          <button type="button" onClick={clearLocks} className="ml-1.5 text-text-secondary underline-offset-2 hover:underline">
                            Clear locks
                          </button>
                        </>
                      ) : (
                        "Lock variables to keep them when you randomize."
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => void save()} disabled={isSaved || busy !== null}>
                        {busy === "save" ? <Loader2 className="animate-spin" /> : isSaved ? <BookmarkCheck /> : <Bookmark />}
                        {isSaved ? "Saved" : "Save concept"}
                      </Button>
                      <Button size="sm" onClick={() => void sendToStudio()} disabled={busy !== null}>
                        {busy === "studio" ? <Loader2 className="animate-spin" /> : null}
                        Send to Create <ArrowRight />
                      </Button>
                    </div>
                  </>
                }
              />
            ) : (
              <ConceptCardSkeleton />
            )}

            {history.length > 1 ? (
              <section aria-label="Session history" className="space-y-3 pb-4">
                <div className="flex items-baseline justify-between">
                  <MetaLabel>This session</MetaLabel>
                  <span className="text-[11px] text-text-muted">Last {history.length} concepts</span>
                </div>
                <div className="grid grid-cols-3 gap-2 md:grid-cols-4 xl:grid-cols-6">
                  {history.map((entry) => (
                    <ConceptTile key={entry.id} compact concept={entry.concept} active={entry.id === current?.id} onSelect={() => setCurrent(entry)} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-border px-5 py-6 lg:block" aria-label="Saved concepts">
          <SavedConcepts />
        </aside>
      </div>
    </div>
  );
}
