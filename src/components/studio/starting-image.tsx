"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, ImagePlus, LoaderCircle, Search, Upload, X } from "lucide-react";
import type { Collection, Generation } from "@/lib/domain/schemas";
import { assetSrc, errorMessage } from "@/lib/client/api";
import { useResource } from "@/lib/client/resource";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStudio } from "@/stores/studio";
import type { StudioSession } from "./use-studio-session";

const MAX_PICK = 4;
const ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * The image the scene works from. Shown at the top of the scene panel so the look
 * being recreated is always visible. Starting images are style references: they
 * carry medium, grain and light, while subject and colour come from the scene.
 */
export function StartingImageSection({ session }: { session: StudioSession }) {
  const referenceIds = useStudio((s) => s.scene.referenceIds);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const starting = session.references.filter((r) => r.role === "style" && referenceIds.includes(r.id));
  const supports = !!session.model?.capabilities.referenceImages;

  const upload = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, MAX_PICK);
    if (!list.length) return toast.error("Drop a PNG, JPEG or WebP image");
    setUploading(true);
    try {
      for (const f of list) await session.startFromUpload(f);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section
      className={cn("rounded-xl px-2 py-2 transition-colors", dragging && "bg-surface")}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload(e.dataTransfer.files);
      }}
      aria-label="Starting image"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] tracking-[0.08em] text-text-muted uppercase">Starting image</span>
        {starting.length ? (
          <button type="button" className="text-[11px] text-text-muted hover:text-text-secondary" onClick={() => setPickerOpen(true)}>
            Add or change
          </button>
        ) : null}
      </div>

      {starting.length ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {starting.map((r) => (
              <div key={r.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetSrc(r.assetId)!}
                  alt={r.label}
                  title={r.label}
                  className={cn("rounded-sm border border-border object-cover", starting.length === 1 ? "h-24 w-auto max-w-full" : "size-16")}
                />
                <button
                  type="button"
                  onClick={() => session.removeStartingImage(r.id)}
                  aria-label={`Remove ${r.label}`}
                  className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-sm bg-black/70 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white focus-visible:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-text-muted">
            {starting.length === 1 ? `${starting[0].label}. Its` : "Their"} medium, grain and light carry over. Subject and colour come from this scene.
          </p>
          {!supports && session.model ? (
            <p className="text-[11px] text-warning/90">{session.model.label} cannot use reference images, so the look will come from the look&apos;s written rules only.</p>
          ) : null}
        </div>
      ) : (
        <div className={cn("rounded-xl border border-dashed p-3.5", dragging ? "border-text-secondary" : "border-border")}>
          <p className="text-[13px] leading-snug text-text-secondary">Start from one of your images, or drop a file here.</p>
          <div className="mt-3 flex gap-1.5">
            <Button size="xs" variant="secondary" onClick={() => setPickerOpen(true)}>
              <ImagePlus /> Choose image
            </Button>
            <Button size="xs" variant="ghost" className="text-text-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <LoaderCircle className="animate-spin" /> : <Upload />} Upload
            </Button>
          </div>
        </div>
      )}
      {uploading && starting.length ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-text-muted">
          <LoaderCircle className="size-3 animate-spin" /> Uploading
        </p>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void upload(e.target.files);
          e.target.value = "";
        }}
      />
      <StartingImagePicker open={pickerOpen} onOpenChange={setPickerOpen} session={session} onUpload={() => fileRef.current?.click()} />
    </section>
  );
}

type Source = "volume" | "favorites" | "all";

export function StartingImagePicker({
  open,
  onOpenChange,
  session,
  onUpload,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: StudioSession;
  onUpload: () => void;
  /** Replaces the default (attach to the current scene), e.g. to start a new scene from the pick. */
  onPick?: (ids: string[], copyScene: boolean) => Promise<void>;
}) {
  const { data: collections } = useResource<{ collections: Collection[] }>(open ? "/api/collections" : null);
  const volume = collections?.collections.find((c) => c.isSeed) ?? null;
  const [source, setSource] = React.useState<Source>("volume");
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<"look" | "scene" | null>(null);

  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setPicked([]);
      setQ("");
    }
  }

  const effective: Source = source === "volume" && collections && !volume ? "all" : source;
  const params = new URLSearchParams({ status: "completed", limit: "120" });
  if (effective === "favorites") params.set("filter", "favorites");
  if (effective === "volume" && volume) params.set("collectionId", volume.id);
  if (q.trim()) params.set("q", q.trim());
  const ready = effective !== "volume" || !!volume;
  const { data, loading } = useResource<{ items: Generation[] }>(open && ready ? `/api/generations?${params}` : null);
  const items = (data?.items ?? []).filter((g) => g.assetId);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_PICK ? p : [...p, id]));

  const run = async (mode: "look" | "scene") => {
    setBusy(mode);
    try {
      if (onPick) await onPick(picked, mode === "scene");
      else await session.startFromImages(picked, { copyScene: mode === "scene" });
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const tabs: { key: Source; label: string }[] = [
    ...(volume ? [{ key: "volume" as const, label: volume.name }] : []),
    { key: "favorites", label: "Favorites" },
    { key: "all", label: "All images" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-medium">Choose a starting image</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Pick up to {MAX_PICK}. The look carries over; you direct the subject, palette and composition.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-border" role="tablist" aria-label="Image source">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={effective === t.key}
                onClick={() => setSource(t.key)}
                className={cn(
                  "h-7 px-2.5 text-[12px] transition-colors",
                  effective === t.key ? "bg-interactive text-foreground" : "text-text-muted hover:text-text-secondary",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and prompts" className="h-7 pl-7 text-[12.5px]" aria-label="Search images" />
          </div>
          <Button size="xs" variant="ghost" className="text-text-secondary" onClick={onUpload}>
            <Upload /> Upload instead
          </Button>
        </div>

        <div className="min-h-48 flex-1 overflow-y-auto">
          {!data && (loading || !ready) ? (
            <div className="flex h-48 items-center justify-center text-[12px] text-text-muted">
              <LoaderCircle className="mr-2 size-3.5 animate-spin" /> Loading images
            </div>
          ) : items.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {items.map((g) => {
                const i = picked.indexOf(g.id);
                const on = i >= 0;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggle(g.id)}
                    aria-pressed={on}
                    aria-label={`${on ? "Deselect" : "Select"} ${g.title}`}
                    className={cn(
                      "group relative overflow-hidden rounded-sm border text-left outline-none focus-visible:ring-1 focus-visible:ring-text-secondary",
                      on ? "border-foreground" : "border-transparent",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetSrc(g.assetId, "thumb")!} alt="" loading="lazy" className={cn("aspect-square w-full object-cover transition-opacity", !on && picked.length >= MAX_PICK && "opacity-40")} />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1.5 py-0.5 text-[10.5px] text-white/80">{g.title}</span>
                    {on ? (
                      <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-sm bg-foreground font-mono text-[10.5px] text-background">
                        {picked.length > 1 ? i + 1 : <Check className="size-3" />}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-center text-[12px] text-text-muted">
              {q ? "No images match that search." : effective === "favorites" ? "No favorites yet." : "No finished images here yet."}
            </div>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-[11.5px] text-text-muted">
            {picked.length ? `${picked.length} selected` : "Select an image"}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={picked.length !== 1 || !!busy}
              onClick={() => void run("scene")}
              title={picked.length > 1 ? "Choose a single image to copy its scene" : undefined}
            >
              {busy === "scene" ? <LoaderCircle className="animate-spin" /> : null}
              Use its look and scene
            </Button>
            <Button size="sm" disabled={!picked.length || !!busy} onClick={() => void run("look")}>
              {busy === "look" ? <LoaderCircle className="animate-spin" /> : null}
              Use {picked.length > 1 ? "their" : "its"} look
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
