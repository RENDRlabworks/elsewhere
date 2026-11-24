"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, Download, ImageIcon, ImageUpscale, LoaderCircle, Share, Sparkles } from "lucide-react";
import type { Generation } from "@/lib/domain/schemas";
import { api, assetSrc, downloadPost, errorMessage } from "@/lib/client/api";
import { mutateResource, useResource } from "@/lib/client/resource";
import {
  CROP_PRESETS,
  cropRatio,
  cropRect,
  defaultFocus,
  type ExportOptions,
  exportFilename,
  exportQuery,
  FORMATS,
  outputSize,
  type ShareText,
  SIZE_PRESETS,
} from "@/lib/share/presets";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/client/use-media";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useShareSheet, type ShareTarget } from "./store";
import { upscaleGeneration } from "@/components/generation/actions";

type ShareTextResponse = ShareText & { saved: boolean; aiAvailable: boolean };

/** Global Share sheet: crop, size and format for posting, with caption and alt text. */
export function ShareSheet() {
  const target = useShareSheet((s) => s.target);
  const close = useShareSheet((s) => s.close);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 max-sm:inset-0 max-sm:data-open:zoom-in-100 max-sm:data-closed:zoom-out-100 max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:pt-[env(safe-area-inset-top)] max-sm:pb-[env(safe-area-inset-bottom)] sm:max-w-5xl">
        {target?.kind === "image" ? <ImageShare key={target.generation.id} g={target.generation} /> : target ? <BatchExport target={target} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Options                                                                    */
/* -------------------------------------------------------------------------- */

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { key: T; label: string; hint: string }[];
  onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.key === value);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] tracking-[0.08em] text-text-muted uppercase">{label}</span>
        <span className="truncate text-[11.5px] text-text-muted">{current?.hint}</span>
      </div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={o.key === value}
            title={o.hint}
            onClick={() => onChange(o.key)}
            className={cn(
              "h-8 rounded-md border px-2.5 text-[12.5px] tabular-nums transition-colors outline-none focus-visible:ring-1 focus-visible:ring-text-secondary",
              o.key === value ? "border-foreground/80 bg-interactive text-foreground" : "border-border text-text-secondary hover:border-text-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExportControls({ options, onChange, showCrop = true }: { options: ExportOptions; onChange: (o: Partial<ExportOptions>) => void; showCrop?: boolean }) {
  return (
    <div className="space-y-4">
      {showCrop ? <Choice label="Crop" value={options.crop} options={CROP_PRESETS} onChange={(crop) => onChange({ crop, focusX: undefined, focusY: undefined })} /> : null}
      <Choice label="Size" value={options.size} options={SIZE_PRESETS} onChange={(size) => onChange({ size })} />
      <Choice label="Format" value={options.format} options={FORMATS.map((f) => ({ ...f, hint: f.key === "png" ? "Lossless, larger" : f.key === "webp" ? "Smaller, modern" : "Works everywhere" }))} onChange={(format) => onChange({ format })} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Crop preview                                                               */
/* -------------------------------------------------------------------------- */

function CropPreview({ g, options, onFocus }: { g: Generation; options: ExportOptions; onFocus: (x: number, y: number) => void }) {
  const src = assetSrc(g.assetId, "full");
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const w = g.width ?? natural?.w ?? 0;
  const h = g.height ?? natural?.h ?? 0;
  const focus = defaultFocus(g);
  const fx = options.focusX ?? focus.x;
  const fy = options.focusY ?? focus.y;
  const rect = w && h ? cropRect(w, h, options.crop, fx, fy) : null;
  const movableX = !!rect && rect.width < w;
  const movableY = !!rect && rect.height < h;
  const drag = React.useRef<{ x: number; y: number; fx: number; fy: number; bw: number; bh: number } | null>(null);
  const out = rect ? outputSize(rect.width, rect.height, options.size) : null;

  const move = (dx: number, dy: number) => {
    onFocus(movableX ? Math.min(1, Math.max(0, fx + dx)) : fx, movableY ? Math.min(1, Math.max(0, fy + dy)) : fy);
  };

  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-3 bg-[#030304] p-4 md:min-h-0 md:flex-1 md:shrink md:p-6">
      <div className="relative h-[38vh] min-h-0 max-w-full md:h-[min(58vh,620px)]" style={{ aspectRatio: w && h ? `${w} / ${h}` : undefined }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="absolute inset-0 size-full rounded-sm object-contain select-none"
          />
        ) : null}
        {rect && cropRatio(options.crop) ? (
          <div className="absolute inset-0 overflow-hidden rounded-sm">
            <div
              role="slider"
              tabIndex={0}
              aria-label="Crop position. Drag, or use the arrow keys."
              aria-valuetext={`${Math.round((movableX ? fx : fy) * 100)}%`}
              aria-valuenow={Math.round((movableX ? fx : fy) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 0.1 : 0.02;
                if (e.key === "ArrowLeft") move(-step, 0);
                else if (e.key === "ArrowRight") move(step, 0);
                else if (e.key === "ArrowUp") move(0, -step);
                else if (e.key === "ArrowDown") move(0, step);
                else return;
                e.preventDefault();
              }}
              onPointerDown={(e) => {
                const box = e.currentTarget.parentElement!.getBoundingClientRect();
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, fx, fy, bw: box.width, bh: box.height };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                const freeX = (1 - rect.width / w) * d.bw;
                const freeY = (1 - rect.height / h) * d.bh;
                onFocus(
                  freeX > 0 ? Math.min(1, Math.max(0, d.fx + (e.clientX - d.x) / freeX)) : d.fx,
                  freeY > 0 ? Math.min(1, Math.max(0, d.fy + (e.clientY - d.y) / freeY)) : d.fy,
                );
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              className={cn(
                "absolute touch-none outline-none ring-1 ring-white/80 focus-visible:ring-2",
                movableX && movableY ? "cursor-move" : movableX ? "cursor-ew-resize" : movableY ? "cursor-ns-resize" : "",
              )}
              style={{
                left: `${(rect.left / w) * 100}%`,
                top: `${(rect.top / h) * 100}%`,
                width: `${(rect.width / w) * 100}%`,
                height: `${(rect.height / h) * 100}%`,
                boxShadow: "0 0 0 9999px rgba(3,3,4,0.72)",
              }}
            >
              <span aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className="border-[0.5px] border-white/40" />
                ))}
              </span>
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-[11.5px] text-text-muted tabular-nums" aria-live="polite">
        {out ? `${out.width} × ${out.height} px` : ""}
        {out?.upscaled ? " · enlarged" : ""}
        {rect && cropRatio(options.crop) && (movableX || movableY) ? " · drag the frame to reposition" : ""}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Caption and alt text                                                       */
/* -------------------------------------------------------------------------- */

function CopyField({
  id,
  label,
  value,
  onChange,
  onBlur,
  rows,
  limit,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  rows: number;
  limit?: number;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[11px] tracking-[0.08em] text-text-muted uppercase">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {limit ? <span className={cn("text-[11px] tabular-nums", value.length > limit ? "text-warning" : "text-text-muted")}>{value.length}</span> : null}
          <button
            type="button"
            aria-label={`Copy ${label.toLowerCase()}`}
            onClick={() => {
              void navigator.clipboard.writeText(value).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              });
            }}
            className="flex items-center gap-1 text-[11.5px] text-text-muted hover:text-foreground"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <Textarea id={id} value={value} rows={rows} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className="resize-none text-[13px] leading-relaxed" />
    </div>
  );
}

function ShareWords({ g, initial, onText }: { g: Generation; initial: ShareTextResponse; onText: (t: { caption: string; altText: string }) => void }) {
  const [caption, setCaption] = React.useState(initial.caption);
  const [altText, setAltText] = React.useState(initial.altText);
  const [last, setLast] = React.useState({ caption: initial.caption, altText: initial.altText });
  const [writing, setWriting] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(
    initial.source === "template" && !initial.saved ? "Drafted from the scene. Edit freely." : initial.source === "ai" ? "Written with AI. Edit freely." : null,
  );
  const key = `/api/generations/${g.id}/share-text`;

  const apply = (t: ShareTextResponse) => {
    setCaption(t.caption);
    setAltText(t.altText);
    setLast({ caption: t.caption, altText: t.altText });
    onText(t);
    mutateResource<ShareTextResponse>(key, () => t);
  };

  async function save() {
    if (caption === last.caption && altText === last.altText) return;
    try {
      const t = await api<ShareTextResponse>(key, { method: "PUT", body: { caption, altText } });
      setLast({ caption: t.caption, altText: t.altText });
      onText(t);
      mutateResource<ShareTextResponse>(key, () => t);
      setNote(t.saved ? "Saved" : "Edits are kept while this sheet is open.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function write() {
    setWriting(true);
    try {
      const t = await api<ShareTextResponse>(key, { method: "POST" });
      apply(t);
      setNote(t.source === "ai" ? "Written with AI. Edit freely." : "Redrafted from the scene.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setWriting(false);
    }
  }

  return (
    <div className="space-y-4">
      <CopyField
        id="share-caption"
        label="Caption"
        value={caption}
        rows={3}
        onChange={(v) => {
          setCaption(v);
          onText({ caption: v, altText });
        }}
        onBlur={() => void save()}
      />
      <CopyField
        id="share-alt"
        label="Alt text"
        value={altText}
        rows={5}
        limit={1000}
        onChange={(v) => {
          setAltText(v);
          onText({ caption, altText: v });
        }}
        onBlur={() => void save()}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-text-muted" aria-live="polite">
          {note}
        </span>
        <Button size="xs" variant="ghost" className="text-text-secondary" onClick={() => void write()} disabled={writing}>
          {writing ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {initial.aiAvailable ? "Write with AI" : "Redraft from scene"}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One image                                                                  */
/* -------------------------------------------------------------------------- */

function ImageShare({ g }: { g: Generation }) {
  const options = useShareSheet((s) => s.options);
  const setOptions = useShareSheet((s) => s.setOptions);
  const { data: text } = useResource<ShareTextResponse>(`/api/generations/${g.id}/share-text`);
  const words = React.useRef<{ caption: string; altText: string } | null>(null);
  const [busy, setBusy] = React.useState<"share" | "copy" | null>(null);
  const url = `/api/generations/${g.id}/export?${exportQuery(options)}`;
  const filename = exportFilename(g.title, options);
  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  // On touch devices the system share sheet is the natural way out (and how photos reach the camera roll).
  const touch = useMediaQuery("(pointer: coarse)");

  async function nativeShare() {
    setBusy("share");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not prepare the image");
      const file = new File([await res.blob()], filename, { type: FORMATS.find((f) => f.key === options.format)!.mime });
      const caption = words.current?.caption ?? text?.caption ?? g.title;
      if (!navigator.canShare({ files: [file] })) throw new Error("This browser cannot share image files. Download it instead.");
      await navigator.share({ files: [file], title: g.title, text: caption });
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function copyImage() {
    setBusy("copy");
    try {
      // Clipboards take PNG everywhere, so the copy is always a PNG of the current crop.
      const png = fetch(`/api/generations/${g.id}/export?${exportQuery({ ...options, format: "png" })}`).then((r) => {
        if (!r.ok) throw new Error("Could not prepare the image");
        return r.blob();
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      toast.success("Image copied", { description: "Paste it into a post." });
    } catch (err) {
      toast.error(errorMessage(err) || "This browser cannot copy images");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <DialogHeader className="border-b border-border px-5 py-4">
        <DialogTitle className="text-[15px] font-medium">Share {g.title}</DialogTitle>
        <DialogDescription className="sr-only">Choose a crop, size and format, and write the caption and alt text to post with it.</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <CropPreview g={g} options={options} onFocus={(focusX, focusY) => setOptions({ focusX, focusY })} />
        <div className="w-full shrink-0 space-y-6 border-t border-border p-4 md:w-[360px] md:overflow-y-auto md:border-t-0 md:border-l md:p-5">
          <ExportControls options={options} onChange={setOptions} />
          {options.size === "large" && Math.max(g.width ?? 0, g.height ?? 0) < 3600 ? (
            <div className="rounded-lg bg-elevated/60 p-3 text-[12px] leading-relaxed text-text-secondary">
              Large enlarges this image with resampling. For real added detail, upscale it with AI first.
              <Button size="xs" variant="secondary" className="mt-2" onClick={() => void upscaleGeneration(g)}>
                <ImageUpscale /> Upscale with AI
              </Button>
            </div>
          ) : null}
          <div className="h-px bg-border" />
          {text ? (
            <ShareWords g={g} initial={text} onText={(t) => (words.current = t)} />
          ) : (
            <div className="flex h-40 items-center justify-center text-[12px] text-text-muted">
              <LoaderCircle className="mr-2 size-3.5 animate-spin" /> Drafting caption and alt text
            </div>
          )}
        </div>
      </div>
      <DialogFooter className="mx-0 mb-0 items-center gap-2 rounded-b-xl border-t border-border bg-transparent px-5 py-3 sm:justify-between">
        <span className="hidden truncate text-[11.5px] text-text-muted sm:block">{filename}</span>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => void copyImage()} disabled={!!busy}>
            {busy === "copy" ? <LoaderCircle className="animate-spin" /> : <ImageIcon />} Copy image
          </Button>
          {canShareFiles ? (
            <Button size="sm" variant={touch ? "default" : "secondary"} className={touch ? "order-last" : ""} onClick={() => void nativeShare()} disabled={!!busy}>
              {busy === "share" ? <LoaderCircle className="animate-spin" /> : <Share />} Share
            </Button>
          ) : null}
          <Button size="sm" variant={touch && canShareFiles ? "secondary" : "default"} asChild>
            <a href={url} download={filename}>
              <Download /> Download
            </a>
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Several images or a collection                                             */
/* -------------------------------------------------------------------------- */

function BatchExport({ target }: { target: Exclude<ShareTarget, { kind: "image" }> }) {
  const options = useShareSheet((s) => s.options);
  const setOptions = useShareSheet((s) => s.setOptions);
  const close = useShareSheet((s) => s.close);
  const [originals, setOriginals] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const count = target.kind === "images" ? target.ids.length : target.count;
  const name = target.kind === "collection" ? target.name : `${count} image${count === 1 ? "" : "s"}`;
  const exportOpts = { crop: options.crop, size: options.size, format: options.format };

  async function run() {
    setBusy(true);
    const t = toast.loading(`Preparing ${count} image${count === 1 ? "" : "s"}`);
    try {
      if (target.kind === "collection") {
        const q = originals ? "" : `?${new URLSearchParams(exportOpts)}`;
        const a = Object.assign(document.createElement("a"), { href: `/api/collections/${target.id}/download${q}` });
        a.click();
        toast.success("Download started", { id: t });
      } else {
        await downloadPost("/api/generations/download", { ids: target.ids.slice(0, 200), export: originals ? null : exportOpts }, `elsewhere-${new Date().toISOString().slice(0, 10)}.zip`);
        toast.success("Download ready", { id: t });
      }
      close();
    } catch (err) {
      toast.error(errorMessage(err), { id: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader className="border-b border-border px-5 py-4">
        <DialogTitle className="text-[15px] font-medium">Export {name}</DialogTitle>
        <DialogDescription className="text-[12.5px]">
          A ZIP in series order, with a captions file holding each image&apos;s caption and alt text.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-5 p-5">
        <div role="radiogroup" aria-label="What to export" className="grid grid-cols-2 gap-2">
          {[
            { v: false, label: "Ready to post", hint: "Cropped, sized and converted" },
            { v: true, label: "Originals", hint: "Untouched files at full size" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={originals === o.v}
              onClick={() => setOriginals(o.v)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-1 focus-visible:ring-text-secondary",
                originals === o.v ? "border-foreground/80 bg-interactive" : "border-border hover:border-text-muted",
              )}
            >
              <div className="text-[13px] text-foreground">{o.label}</div>
              <div className="mt-0.5 text-[11.5px] text-text-muted">{o.hint}</div>
            </button>
          ))}
        </div>
        {originals ? null : (
          <>
            <ExportControls options={options} onChange={setOptions} />
            {options.crop !== "original" ? (
              <p className="text-[11.5px] text-text-muted">Each crop keeps its subject where the composition placed it.</p>
            ) : null}
          </>
        )}
      </div>
      <DialogFooter className="mx-0 mb-0 rounded-b-xl border-t border-border bg-transparent px-5 py-3">
        <Button size="sm" variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void run()} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Download />} Download ZIP
        </Button>
      </DialogFooter>
    </>
  );
}
