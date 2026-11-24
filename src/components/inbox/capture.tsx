"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { create } from "zustand";
import { ClipboardPaste, ImagePlus, LoaderCircle, X } from "lucide-react";
import type { Idea } from "@/lib/domain/schemas";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate } from "@/lib/client/resource";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

export const INBOX_KEYS = ["/api/inbox"];

/** Global quick capture. N opens it anywhere; the phone's bottom bar has a button. */
export const useCapture = create<{ open: boolean; show: () => void; close: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));

async function saveIdea(text: string, file: File | null) {
  const form = new FormData();
  form.set("text", text);
  if (file) form.set("file", file);
  const { idea } = await api<{ idea: Idea }>("/api/inbox", { method: "POST", form });
  invalidate(...INBOX_KEYS);
  return idea;
}

/** The first image in a paste or drop, from any source a browser hands over. */
function imageFrom(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  return Array.from(data.files ?? []).find((f) => f.type.startsWith("image/")) ?? null;
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
const named = (blob: Blob) => new File([blob], `pasted-photo.${EXT[blob.type] ?? "png"}`, { type: blob.type || "image/png" });

const canReadClipboard = () => typeof navigator !== "undefined" && !!navigator.clipboard && typeof navigator.clipboard.read === "function";

/**
 * Text, a link or a photo. Links in the text are picked out on save. A photo can be
 * chosen, pasted (into the box, anywhere on the page with pasteAnywhere, or with the
 * Paste button on a phone) or dropped onto the box.
 */
export function Composer({
  autoFocus,
  onSaved,
  compact,
  pasteAnywhere,
}: {
  autoFocus?: boolean;
  onSaved?: (idea: Idea) => void;
  compact?: boolean;
  /** Also take an image pasted while nothing else is focused (the Inbox page). */
  pasteAnywhere?: boolean;
}) {
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const can = !busy && (text.trim().length > 0 || !!file);
  // Only where the browser can read images from the clipboard (checked after hydration).
  const clipboardReadable = React.useSyncExternalStore(
    () => () => {},
    canReadClipboard,
    () => false,
  );

  const pick = React.useCallback((f: File | null) => {
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return f ? URL.createObjectURL(f) : null;
    });
    setFile(f);
  }, []);

  // Paste a photo with nothing focused, e.g. straight after copying it in another app.
  React.useEffect(() => {
    if (!pasteAnywhere) return;
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, [contenteditable=true]") || t.closest("[role=dialog]"))) return;
      const img = imageFrom(e.clipboardData);
      if (!img) return;
      e.preventDefault();
      pick(img);
      textRef.current?.focus();
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pasteAnywhere, pick]);

  async function pasteFromClipboard() {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          pick(named(await item.getType(type)));
          return;
        }
      }
      toast("No photo on the clipboard", { description: "Copy a photo first, then tap Paste." });
    } catch {
      toast.error("Elsewhere could not read the clipboard", { description: "Allow pasting when asked, or long-press in the text box and choose Paste." });
    }
  }

  async function submit() {
    if (!can) return;
    setBusy(true);
    try {
      const idea = await saveIdea(text, file);
      setText("");
      pick(null);
      onSaved?.(idea);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onPaste={(e) => {
        const img = imageFrom(e.clipboardData);
        if (img) {
          e.preventDefault();
          pick(img);
        }
      }}
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
        pick(img);
      }}
      aria-label="New idea"
      className={cn(
        "rounded-xl border bg-surface transition-colors focus-within:border-text-muted",
        dragging ? "border-text-secondary bg-elevated" : "border-border",
      )}
    >
      <label htmlFor="idea-text" className="sr-only">
        Idea
      </label>
      <textarea
        ref={textRef}
        id="idea-text"
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
        rows={compact ? 2 : 3}
        placeholder={dragging ? "Drop the photo here" : "A fox asleep in a lighthouse lamp. A link. A photo of the light this morning."}
        className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[16px] leading-relaxed text-foreground outline-none placeholder:text-text-muted md:text-[14px]"
      />
      {preview ? (
        <div className="relative mx-4 mb-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Attached photo" className="h-24 rounded-md object-cover" />
          <button
            type="button"
            aria-label="Remove photo"
            onClick={() => pick(null)}
            className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-elevated text-text-secondary ring-1 ring-border hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
        <div className="flex items-center gap-0.5">
          <Button type="button" size="sm" variant="ghost" className="text-text-secondary" onClick={() => fileRef.current?.click()}>
            <ImagePlus /> {file ? "Change photo" : "Photo"}
          </Button>
          {clipboardReadable ? (
            <Button type="button" size="sm" variant="ghost" className="text-text-secondary" onClick={() => void pasteFromClipboard()}>
              <ClipboardPaste /> Paste
            </Button>
          ) : null}
          <span className="ml-1 hidden text-[11.5px] text-text-muted lg:inline">or paste or drop one here</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-2">
          <span className="hidden text-[11.5px] text-text-muted md:inline">
            <Kbd>⌘</Kbd> <Kbd>↵</Kbd>
          </span>
          <Button type="submit" size="sm" disabled={!can}>
            {busy ? <LoaderCircle className="animate-spin" /> : null} Save to inbox
          </Button>
        </div>
      </div>
    </form>
  );
}

export function CaptureDialog() {
  const { open, close } = useCapture();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className={cn("top-[12vh] translate-y-0 gap-3 sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">Capture an idea</DialogTitle>
          <DialogDescription className="text-[12.5px]">It waits in your inbox until you make it a scene.</DialogDescription>
        </DialogHeader>
        <Composer
          autoFocus
          compact
          onSaved={() => {
            close();
            toast.success("Saved to your inbox", {
              action: { label: "Open inbox", onClick: () => router.push("/inbox") },
            });
          }}
        />
        <Link href="/inbox" onClick={close} className="self-start text-[12px] text-text-muted hover:text-text-secondary">
          Open inbox
        </Link>
      </DialogContent>
    </Dialog>
  );
}
