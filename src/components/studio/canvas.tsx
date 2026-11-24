"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  Expand,
  FolderPlus,
  Heart,
  LoaderCircle,
  Maximize,
  Minimize,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Scan,
  Sparkles,
  SplitSquareHorizontal,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Generation } from "@/lib/domain/schemas";
import { assetSrc } from "@/lib/client/api";
import { cn, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { IconButton, MetaLabel } from "@/components/common/primitives";
import { GenerationContextMenu, TileState } from "@/components/generation/generation-tile";
import { FillLoader } from "@/components/generation/generation-loader";
import {
  downloadGeneration,
  isActive,
  setReviewStatus,
  STATUS_LABEL,
  toggleFavorite,
  useCollectionPicker,
} from "@/components/generation/actions";
import { useApp } from "@/stores/app";
import { useUi } from "@/stores/ui";
import { useStudio } from "@/stores/studio";
import { CANVAS_BACKGROUNDS, CompareSlider, ImageViewer, type ZoomState } from "./image-viewer";
import type { StudioSession } from "./use-studio-session";

function useElapsed(since: string | null, active: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (!since) return "";
  const s = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function SaveIndicator() {
  const saveState = useStudio((s) => s.saveState);
  const saveError = useStudio((s) => s.saveError);
  const autosave = useApp((s) => s.data?.preferences.autosave.enabled);
  const label =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Not saved"
          : saveState === "dirty"
            ? autosave
              ? "Unsaved changes"
              : "Unsaved, ⌘S to save"
            : "";
  return (
    <span
      className={cn("text-[11.5px]", saveState === "error" ? "text-danger" : "text-text-muted")}
      title={saveError ?? undefined}
      role="status"
      aria-live="polite"
    >
      {label}
    </span>
  );
}

function DirectionPopover({
  icon,
  label,
  shortcut,
  placeholder,
  onSubmit,
  disabled,
}: {
  icon: typeof Wand2;
  label: string;
  shortcut?: string;
  placeholder: string;
  onSubmit: (instruction: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span>
          <IconButton icon={icon} label={label} shortcut={shortcut} disabled={disabled} side="top" />
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-80 space-y-2 p-3">
        <MetaLabel>{label}</MetaLabel>
        <Textarea
          autoFocus
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="resize-none text-[12.5px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              onSubmit(text.trim());
              setOpen(false);
              setText("");
            }
          }}
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onSubmit(text.trim());
              setOpen(false);
              setText("");
            }}
          >
            Run <Kbd className="ml-1">⌘↵</Kbd>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EmptyCanvas({ session }: { session: StudioSession }) {
  const scene = useStudio((s) => s.scene);
  const [w, h] = scene.output.aspectRatio.split(":").map(Number);
  const c = scene.composition;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-10">
      <div className="relative max-h-[52%] rounded-sm border border-dashed border-border" style={{ aspectRatio: `${w} / ${h}`, height: "52%" }}>
        <div className="absolute inset-0 flex">
          {scene.palette.swatches.map((s) => (
            <div key={s.id} className="flex-1 opacity-[0.12]" style={{ background: s.hex }} />
          ))}
        </div>
        {scene.subject.kind !== "none" ? (
          <div
            className="absolute w-[3px] -translate-x-1/2 -translate-y-full rounded-full bg-text-muted"
            style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, height: `${Math.max(2, c.subjectHeight)}%` }}
          />
        ) : null}
      </div>
      <div className="text-center">
        <div className="text-[13px] text-foreground">{scene.title || "Untitled scene"}</div>
        <div className="mt-1 max-w-sm text-[12.5px] text-text-muted">
          Direct the scene on the left. The frame above previews the subject&apos;s placement and palette.
        </div>
      </div>
      <Button onClick={() => void session.generate()} disabled={session.generating}>
        {session.generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Generate
        <Kbd className="ml-1 bg-black/10 text-primary-foreground">⌘↵</Kbd>
      </Button>
    </div>
  );
}

function PendingCanvas({ g, session }: { g: Generation; session: StudioSession }) {
  const elapsed = useElapsed(g.createdAt, isActive(g.status));
  const active = isActive(g.status);
  const ratio = g.width && g.height ? `${g.width} / ${g.height}` : "4 / 5";
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="relative flex max-h-full max-w-full flex-col items-center justify-center rounded-sm border border-border bg-surface" style={{ aspectRatio: ratio, height: "80%" }}>
        {active ? (
          <FillLoader id={g.id} inset={24}>
            <div className="absolute inset-x-0 bottom-4 flex justify-center">
              <div className="flex items-center gap-3 rounded-md border border-border bg-surface/90 py-1 pr-1 pl-3 backdrop-blur-sm">
                <span className="label-meta">{STATUS_LABEL[g.status]}</span>
                <span className="font-mono text-[12px] text-text-muted tabular-nums">{elapsed}</span>
                <Button size="sm" variant="ghost" onClick={() => void session.cancel(g)}>
                  Cancel
                </Button>
              </div>
            </div>
          </FillLoader>
        ) : (
          <div className="relative flex flex-col items-center gap-3 px-6 text-center">
            <TileState status={g.status} error={g.errorMessage} />
            <div className="relative mt-24 flex gap-2">
              {g.jobId ? (
                <Button size="sm" variant="secondary" onClick={() => void session.retry(g)}>
                  <RotateCcw /> Retry
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Canvas({ session }: { session: StudioSession }) {
  const g = session.selected;
  const gens = session.generations;
  const scene = useStudio((s) => s.scene);
  const seriesIndex = useStudio((s) => s.seriesIndex);
  const compareMode = useStudio((s) => s.compareMode);
  const compareId = useStudio((s) => s.compareId);
  const setCompare = useStudio((s) => s.setCompare);
  const select = useStudio((s) => s.select);
  const { fullscreen, setFullscreen, inspectorOpen, toggleInspector, scenePanelOpen, toggleScenePanel } = useUi();
  const defaultBg = useApp((s) => s.data?.preferences.ui.canvasBackground ?? "app");
  const [bg, setBg] = React.useState<string>(defaultBg);
  const [zoom, setZoom] = React.useState<ZoomState>({ mode: "fit" });
  const [scale, setScale] = React.useState(1);
  const picker = useCollectionPicker();

  const [seen, setSeen] = React.useState({ bg: defaultBg, id: g?.id });
  if (seen.bg !== defaultBg || seen.id !== g?.id) {
    if (seen.bg !== defaultBg) setBg(defaultBg);
    if (seen.id !== g?.id) setZoom({ mode: "fit" });
    setSeen({ bg: defaultBg, id: g?.id });
  }

  const idx = g ? gens.findIndex((x) => x.id === g.id) : -1;
  const done = !!g && g.status === "completed" && !!g.assetId;
  const compareWith = compareId
    ? gens.find((x) => x.id === compareId)
    : ((g?.parentId ? gens.find((x) => x.id === g.parentId) : undefined) ?? gens[idx + 1] ?? gens[idx - 1]);
  const canCompare = done && !!compareWith?.assetId && compareWith.id !== g?.id;

  const step = React.useCallback(
    (d: number) => {
      if (!gens.length) return;
      const next = gens[Math.min(gens.length - 1, Math.max(0, idx + d))];
      if (next) select(next.id);
    },
    [gens, idx, select],
  );

  const toggleCompare = React.useCallback(() => {
    if (!canCompare) {
      toast("Nothing to compare yet", { description: "Generate a variation or another image of this scene first." });
      return;
    }
    setCompare(compareMode === "off" ? (compareWith?.id ?? null) : null, compareMode === "off" ? "slider" : "off");
  }, [canCompare, compareMode, compareWith, setCompare]);

  const toggleFullscreen = React.useCallback(() => {
    const next = !useUi.getState().fullscreen;
    setFullscreen(next);
    if (next) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [setFullscreen]);

  React.useEffect(() => {
    const onExit = () => {
      if (!document.fullscreenElement && useUi.getState().fullscreen) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onExit);
    return () => document.removeEventListener("fullscreenchange", onExit);
  }, [setFullscreen]);

  // Studio keyboard shortcuts.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.getAttribute("role") === "combobox");
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        void session.generate();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void session.save().then((id) => id && toast.success("Scene saved"));
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useStudio.getState().redo();
        else useStudio.getState().undo();
        return;
      }
      if (mod || e.altKey) return;
      const k = e.key;
      if (k === "Escape" && useUi.getState().fullscreen) toggleFullscreen();
      else if (k === "F" && e.shiftKey) toggleFullscreen();
      else if (k === "r" || k === "R") void session.randomize();
      else if (k === "f" && done) void toggleFavorite(g!);
      else if (k === "a" && done) void setReviewStatus(g!, g!.reviewStatus === "accepted" ? "unreviewed" : "accepted");
      else if (k === "x" && done) void setReviewStatus(g!, g!.reviewStatus === "rejected" ? "unreviewed" : "rejected");
      else if (k === "v" && done) void session.generate({ operation: "variation", parentId: g!.id });
      else if (k === "i") toggleInspector();
      else if (k === "[") step(-1);
      else if (k === "]") step(1);
      else if (k === "0") setZoom({ mode: "fit" });
      else if (k === "1") setZoom({ mode: "scale", scale: 1 });
      else if (k === "c") toggleCompare();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, g, done, step, toggleCompare, toggleFullscreen, toggleInspector]);

  const full = done ? assetSrc(g!.assetId, "full")! : "";
  const thumb = done ? assetSrc(g!.assetId, "thumb") : null;

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-2">
        {!fullscreen ? <IconButton icon={PanelLeft} label="Toggle scene panel" active={scenePanelOpen} onClick={toggleScenePanel} /> : null}
        <div className="flex min-w-0 flex-1 items-baseline gap-2 px-1">
          {seriesIndex ? <span className="font-mono text-[11px] text-text-muted">{String(seriesIndex).padStart(2, "0")}</span> : null}
          <span className="truncate text-[13px] text-foreground">{scene.title || "Untitled scene"}</span>
          <SaveIndicator />
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton icon={ZoomOut} label="Zoom out" disabled={!done} onClick={() => setZoom({ mode: "scale", scale: Math.max(0.05, scale / 1.25) })} />
          <button
            type="button"
            disabled={!done}
            onClick={() => setZoom(zoom.mode === "fit" ? { mode: "scale", scale: 1 } : { mode: "fit" })}
            className="w-12 font-mono text-[11px] text-text-muted tabular-nums hover:text-text-secondary disabled:opacity-40"
            aria-label="Toggle fit and actual size"
          >
            {done ? `${Math.round(scale * 100)}%` : "n/a"}
          </button>
          <IconButton icon={ZoomIn} label="Zoom in" disabled={!done} onClick={() => setZoom({ mode: "scale", scale: Math.min(8, scale * 1.25) })} />
          <IconButton icon={Scan} label="Fit to canvas" shortcut="0" disabled={!done} active={zoom.mode === "fit"} onClick={() => setZoom({ mode: "fit" })} />
          <IconButton icon={Expand} label="Actual size" shortcut="1" disabled={!done} active={zoom.mode === "scale" && scale === 1} onClick={() => setZoom({ mode: "scale", scale: 1 })} />
          <Separator orientation="vertical" className="mx-1 h-4" />
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Canvas background" className="flex size-7 items-center justify-center rounded-md hover:bg-interactive">
                <span className={cn("size-3.5 rounded-sm border border-border", CANVAS_BACKGROUNDS[bg]?.className)} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <div className="flex gap-1.5">
                {Object.entries(CANVAS_BACKGROUNDS).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBg(k)}
                    aria-label={`${v.label} background`}
                    aria-pressed={bg === k}
                    className={cn("size-6 rounded-sm border", v.className, bg === k ? "border-foreground" : "border-border")}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <IconButton
            icon={compareMode === "side" ? Columns2 : SplitSquareHorizontal}
            label={compareMode === "off" ? "Compare" : "Stop comparing"}
            shortcut="C"
            active={compareMode !== "off"}
            disabled={!canCompare}
            onClick={toggleCompare}
          />
          {compareMode !== "off" ? (
            <button type="button" className="px-1 text-[11px] text-text-muted hover:text-text-secondary" onClick={() => setCompare(compareWith?.id ?? null, compareMode === "slider" ? "side" : "slider")}>
              {compareMode === "slider" ? "Side by side" : "Slider"}
            </button>
          ) : null}
          <IconButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? "Exit fullscreen" : "Fullscreen"} shortcut="⇧F" onClick={toggleFullscreen} />
          {!fullscreen ? <IconButton icon={PanelRight} label="Toggle inspector" shortcut="I" active={inspectorOpen} onClick={toggleInspector} /> : null}
        </div>
        <Button size="sm" className="ml-1" onClick={() => void session.generate()} disabled={session.generating} aria-keyshortcuts="Meta+Enter">
          {session.generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          Generate{scene.output.count > 1 ? ` ${scene.output.count}` : ""}
        </Button>
      </div>

      {/* Stage */}
      <div className={cn("relative min-h-0 flex-1", CANVAS_BACKGROUNDS[bg]?.className)}>
        {!gens.length ? (
          <EmptyCanvas session={session} />
        ) : !g ? null : !done ? (
          <PendingCanvas g={g} session={session} />
        ) : compareMode !== "off" && compareWith?.assetId ? (
          compareMode === "slider" ? (
            <CompareSlider before={assetSrc(compareWith.assetId, "full")!} after={full} width={g.width ?? 1024} height={g.height ?? 1280} />
          ) : (
            <div className="grid h-full grid-cols-2 gap-px bg-border">
              {[compareWith, g].map((x, i) => (
                <div key={x.id} className={cn("relative", CANVAS_BACKGROUNDS[bg]?.className)}>
                  <ImageViewer src={assetSrc(x.assetId, "full")!} width={x.width ?? 1024} height={x.height ?? 1280} zoom={{ mode: "fit" }} onZoomChange={() => {}} alt={x.title} padding={20} />
                  <span className="label-meta absolute top-2 left-2 rounded-sm bg-black/60 px-1.5 py-0.5">{i === 0 ? "Before" : "After"}</span>
                </div>
              ))}
            </div>
          )
        ) : (
          <GenerationContextMenu generation={g}>
            <div className="h-full">
              <ImageViewer
                src={full}
                placeholder={thumb}
                width={g.width ?? 1024}
                height={g.height ?? 1280}
                zoom={zoom}
                alt={g.title}
                onZoomChange={(z, s) => {
                  setZoom(z);
                  setScale(s);
                }}
              />
            </div>
          </GenerationContextMenu>
        )}

        {g?.isDevPlaceholder && done ? (
          <div className="absolute top-3 left-3 rounded-sm bg-black/70 px-2 py-1 font-mono text-[10.5px] text-warning">
            Development sketch. Not generated artwork.
          </div>
        ) : null}

        {gens.length > 1 ? (
          <>
            <button type="button" aria-label="Previous image" onClick={() => step(-1)} disabled={idx <= 0} className="absolute top-1/2 left-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:bg-black/40 hover:text-foreground disabled:hidden">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" aria-label="Next image" onClick={() => step(1)} disabled={idx >= gens.length - 1} className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:bg-black/40 hover:text-foreground disabled:hidden">
              <ChevronRight className="size-4" />
            </button>
          </>
        ) : null}

        {/* Action bar */}
        {done ? (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-elevated/95 p-1">
            <IconButton icon={Heart} label={g!.favorite ? "Unfavorite" : "Favorite"} shortcut="F" side="top" active={g!.favorite} onClick={() => void toggleFavorite(g!)} className={g!.favorite ? "[&_svg]:fill-current" : ""} />
            <IconButton icon={Check} label="Accept" shortcut="A" side="top" active={g!.reviewStatus === "accepted"} onClick={() => void setReviewStatus(g!, g!.reviewStatus === "accepted" ? "unreviewed" : "accepted")} className={g!.reviewStatus === "accepted" ? "text-success" : ""} />
            <IconButton icon={X} label="Reject (keeps it in the archive)" shortcut="X" side="top" active={g!.reviewStatus === "rejected"} onClick={() => void setReviewStatus(g!, g!.reviewStatus === "rejected" ? "unreviewed" : "rejected")} className={g!.reviewStatus === "rejected" ? "text-danger" : ""} />
            <Separator orientation="vertical" className="mx-1 h-4" />
            <IconButton icon={Sparkles} label="Generate variation" shortcut="V" side="top" disabled={session.generating} onClick={() => void session.generate({ operation: "variation", parentId: g!.id })} />
            <DirectionPopover icon={Wand2} label="Refine this image" placeholder="Darken the sky and move the fox slightly left" disabled={session.generating} onSubmit={(instruction) => void session.generate({ operation: "refine", parentId: g!.id, instruction, countOverride: 1 })} />
            <Separator orientation="vertical" className="mx-1 h-4" />
            <IconButton icon={FolderPlus} label="Add to collection" side="top" onClick={() => picker.show([g!.id])} />
            <IconButton icon={Download} label="Download original" side="top" onClick={() => downloadGeneration(g!)} />
          </div>
        ) : null}
      </div>

      {/* Filmstrip */}
      {gens.length && !fullscreen ? (
        <div className="flex h-[84px] shrink-0 items-center gap-2 overflow-x-auto border-t border-border px-3" role="listbox" aria-label="Images for this scene">
          {gens.map((x) => (
            <GenerationContextMenu key={x.id} generation={x}>
              <button
                type="button"
                role="option"
                aria-selected={x.id === g?.id}
                onClick={(e) => (e.altKey ? setCompare(x.id, compareMode === "off" ? "slider" : compareMode) : select(x.id))}
                title={`${x.title}${x.costUsd != null ? ` · ${formatUsd(x.costUsd, x.costEstimated)}` : ""} · Alt-click to compare`}
                className={cn(
                  "relative h-[60px] shrink-0 overflow-hidden rounded-sm border transition-colors",
                  x.id === g?.id ? "border-foreground" : x.id === compareId ? "border-info" : "border-transparent opacity-70 hover:opacity-100",
                  x.reviewStatus === "rejected" && "opacity-35",
                )}
                style={{ aspectRatio: x.width && x.height ? `${x.width} / ${x.height}` : "4 / 5" }}
              >
                {x.assetId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetSrc(x.assetId)!} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex size-full items-center justify-center bg-surface">
                    {isActive(x.status) ? <FillLoader id={x.id} inset={3} /> : <X className="size-3 text-danger" />}
                  </span>
                )}
                {x.kind !== "generate" ? <span className="absolute bottom-0.5 left-0.5 rounded-[2px] bg-black/70 px-1 font-mono text-[8.5px] text-text-secondary uppercase">{x.kind === "variation" ? "var" : x.kind}</span> : null}
                {x.favorite ? <Heart className="absolute top-0.5 right-0.5 size-2.5 fill-foreground text-foreground" /> : null}
              </button>
            </GenerationContextMenu>
          ))}
        </div>
      ) : null}
    </div>
  );
}
