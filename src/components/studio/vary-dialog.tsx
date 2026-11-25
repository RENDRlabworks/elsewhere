"use client";

import * as React from "react";
import { toast } from "sonner";
import { ClipboardPaste, ImagePlus, LoaderCircle, Minus, Plus, Sparkles, X } from "lucide-react";
import { canReadClipboard, imageFrom, readClipboardImage } from "@/lib/client/clipboard";
import { errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { StudioSession } from "./use-studio-session";

const MAX = 8;
const STRENGTHS = [
  { key: "subtle", label: "Subtle", hint: "Same picture, small changes" },
  { key: "strong", label: "Strong", hint: "Same feel, new take" },
] as const;

/**
 * Paste an image and ask for a number of variations of it. The image keeps its own
 * look: no Style DNA or scene settings are added to the prompt.
 */
export function VaryDialog({
  open,
  onOpenChange,
  session,
  initialFile,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: StudioSession;
  initialFile: File | null;
}) {
  const [file, setFile] = React.useState<File | null>(initialFile);
  const [count, setCount] = React.useState(4);
  const [strength, setStrength] = React.useState<"subtle" | "strong">("subtle");
  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const clipboardReadable = React.useSyncExternalStore(
    () => () => {},
    canReadClipboard,
    () => false,
  );

  // A new image handed in from outside (a paste on the start screen) replaces the current one.
  const [seen, setSeen] = React.useState<File | null>(initialFile);
  if (initialFile !== seen) {
    setSeen(initialFile);
    if (initialFile) setFile(initialFile);
  }

  const preview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  React.useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function paste() {
    try {
      const img = await readClipboardImage();
      if (img) setFile(img);
      else toast("No image on the clipboard", { description: "Copy an image first, then paste." });
    } catch {
      toast.error("Elsewhere could not read the clipboard", { description: "Allow pasting when asked, or press ⌘V here." });
    }
  }

  async function run() {
    if (!file || busy) return;
    setBusy(true);
    try {
      onOpenChange(false);
      await session.varyImage(file, { count, strength, instruction: instruction.trim() });
      setFile(null);
      setInstruction("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const batches = Math.ceil(count / session.maxPerRequest);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] flex-col gap-4 sm:max-w-lg"
        onPaste={(e) => {
          const img = imageFrom(e.clipboardData);
          if (img) {
            e.preventDefault();
            setFile(img);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">Variations of an image</DialogTitle>
          <DialogDescription className="text-[12.5px]">The image keeps its own look. Nothing from your looks or scenes is added.</DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            if (![...e.dataTransfer.types].includes("Files")) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(e) => {
            const img = imageFrom(e.dataTransfer);
            setDragging(false);
            if (!img) return;
            e.preventDefault();
            setFile(img);
          }}
          className={cn(
            "relative flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-[#030304] transition-colors",
            dragging ? "border-text-secondary" : "border-border",
          )}
        >
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Image to vary" className="max-h-[36vh] w-auto object-contain" />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => setFile(null)}
                className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/70 text-white/80 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="text-[13px] text-text-secondary">Paste an image (⌘V), drop one here, or choose a file.</p>
              <div className="flex gap-1.5">
                {clipboardReadable ? (
                  <Button size="sm" variant="secondary" onClick={() => void paste()}>
                    <ClipboardPaste /> Paste
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" className="text-text-secondary" onClick={() => fileRef.current?.click()}>
                  <ImagePlus /> Choose
                </Button>
              </div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setFile(f);
            }}
          />
        </div>

        <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3">
          <span className="text-[11px] tracking-[0.08em] text-text-muted uppercase">How many</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-surface p-0.5">
              <Button size="icon-sm" variant="ghost" aria-label="Fewer" disabled={count <= 1} onClick={() => setCount((c) => Math.max(1, c - 1))}>
                <Minus />
              </Button>
              <output aria-live="polite" aria-label="Number of variations" className="w-8 text-center text-[14px] text-foreground tabular-nums">
                {count}
              </output>
              <Button size="icon-sm" variant="ghost" aria-label="More" disabled={count >= MAX} onClick={() => setCount((c) => Math.min(MAX, c + 1))}>
                <Plus />
              </Button>
            </div>
            {batches > 1 ? <span className="text-[11.5px] text-text-muted">Runs as {batches} batches</span> : null}
          </div>

          <span className="text-[11px] tracking-[0.08em] text-text-muted uppercase">How close</span>
          <div role="radiogroup" aria-label="How close" className="flex flex-wrap gap-1">
            {STRENGTHS.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={strength === s.key}
                onClick={() => setStrength(s.key)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-left text-[12.5px] transition-colors",
                  strength === s.key ? "border-foreground/80 bg-interactive text-foreground" : "border-border text-text-secondary hover:border-text-muted",
                )}
              >
                {s.label}
                <span className="ml-1.5 text-text-muted">{s.hint}</span>
              </button>
            ))}
          </div>

          <label htmlFor="vary-direction" className="text-[11px] tracking-[0.08em] text-text-muted uppercase">
            Direction
          </label>
          <Input
            id="vary-direction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
            }}
            placeholder="Optional, e.g. at dusk, in snow"
            className="h-9 text-[16px] md:text-[13px]"
          />
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-b-xl bg-transparent p-0 pt-1">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!file || busy} onClick={() => void run()}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Make {count} variation{count === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
