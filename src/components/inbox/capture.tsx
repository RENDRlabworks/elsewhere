"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { create } from "zustand";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
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

/** Text, a link or a photo. Links in the text are picked out on save. */
export function Composer({ autoFocus, onSaved, compact }: { autoFocus?: boolean; onSaved?: (idea: Idea) => void; compact?: boolean }) {
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const can = !busy && (text.trim().length > 0 || !!file);

  const pick = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

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
      className="rounded-xl border border-border bg-surface focus-within:border-text-muted"
    >
      <label htmlFor="idea-text" className="sr-only">
        Idea
      </label>
      <textarea
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
        onPaste={(e) => {
          const img = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
          if (img) {
            e.preventDefault();
            pick(img);
          }
        }}
        rows={compact ? 2 : 3}
        placeholder="A fox asleep in a lighthouse lamp. A link. A photo of the light this morning."
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
        <Button type="button" size="sm" variant="ghost" className="text-text-secondary" onClick={() => fileRef.current?.click()}>
          <ImagePlus /> {file ? "Change photo" : "Photo"}
        </Button>
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
