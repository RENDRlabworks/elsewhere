"use client";

import * as React from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronLeft, ChevronRight, ImageUpscale, Palette, Share, PenLine, Star, Wand2, X } from "lucide-react";
import type { Generation } from "@/lib/domain/schemas";
import { assetSrc } from "@/lib/client/api";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/common/primitives";
import { upscaleGeneration, useStyleReferencePicker } from "@/components/generation/actions";
import { shareImage } from "@/components/share/store";

/** A quiet full-screen viewer with prev/next. Escape closes, arrows navigate. */
export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
  numberFor,
}: {
  images: Generation[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  numberFor?: (g: Generation) => string | null;
}) {
  const open = index !== null && index >= 0 && index < images.length;
  const g = open ? images[index] : null;
  const n = images.length;
  const contentRef = React.useRef<HTMLDivElement>(null);
  const showStylePicker = useStyleReferencePicker((s) => s.show);
  const go = (d: number) => {
    if (index === null || !n) return;
    onIndexChange((index + d + n) % n);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Content
          ref={contentRef}
          tabIndex={-1}
          onOpenAutoFocus={(e) => {
            // Focus the viewer itself so arrows work and no tooltip pops open.
            e.preventDefault();
            contentRef.current?.focus();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-black outline-none data-open:animate-in data-open:fade-in-0"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              go(1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              go(-1);
            }
          }}
          aria-describedby={undefined}
        >
          {g ? (
            <>
              <div className="flex h-14 shrink-0 items-center justify-between gap-4 px-5">
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="font-mono text-[11px] text-white/45 tabular-nums">
                    {numberFor?.(g) ? `No. ${numberFor(g)}` : `${index! + 1} / ${n}`}
                  </span>
                  <DialogPrimitive.Title className="truncate text-[13px] text-white/85">{g.title}</DialogPrimitive.Title>
                  <span className="hidden shrink-0 text-[12px] text-white/40 sm:inline">
                    {formatDate(g.createdAt)}
                    {g.model ? ` · ${g.model}` : ""}
                    {g.rating ? (
                      <span className="ml-2 inline-flex items-center gap-0.5">
                        <Star className="size-3" /> {g.rating}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button asChild size="sm" variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white">
                    <Link href={`/studio?generation=${g.id}`}>
                      <PenLine /> Open in Create
                    </Link>
                  </Button>
                  {g.assetId && g.status === "completed" ? (
                    <>
                      <Button asChild size="sm" variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white">
                        <Link href={`/studio?recreate=${g.id}`}>
                          <Wand2 /> Recreate in this style
                        </Link>
                      </Button>
                      <IconButton
                        icon={ImageUpscale}
                        label="Upscale with AI"
                        onClick={() => void upscaleGeneration(g)}
                        className="text-white/70 hover:bg-white/10 hover:text-white"
                      />
                      <IconButton
                        icon={Palette}
                        label="Use as style reference"
                        onClick={() => {
                          onClose();
                          showStylePicker([g.id]);
                        }}
                        className="text-white/70 hover:bg-white/10 hover:text-white"
                      />
                    </>
                  ) : null}
                  {g.assetId ? (
                    <IconButton icon={Share} label="Share or export" onClick={() => shareImage(g)} className="text-white/70 hover:bg-white/10 hover:text-white" />
                  ) : null}
                  <IconButton icon={X} label="Close" shortcut="Esc" onClick={onClose} className="text-white/70 hover:bg-white/10 hover:text-white" />
                </div>
              </div>
              <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 pb-10">
                <LightboxImage key={g.id} g={g} />
                {n > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      aria-label="Previous image"
                      className="absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-white/50 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-1 focus-visible:ring-white/50"
                    >
                      <ChevronLeft className="size-5" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      aria-label="Next image"
                      className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-white/50 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-1 focus-visible:ring-white/50"
                    >
                      <ChevronRight className="size-5" strokeWidth={1.5} />
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <DialogPrimitive.Title className="sr-only">Image viewer</DialogPrimitive.Title>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function LightboxImage({ g }: { g: Generation }) {
  const [loaded, setLoaded] = React.useState(false);
  const thumb = assetSrc(g.assetId, "thumb");
  const full = assetSrc(g.assetId, "full");
  const ratio = g.width && g.height ? `${g.width} / ${g.height}` : undefined;
  return (
    <div className="relative flex size-full items-center justify-center">
      {/* The thumbnail holds the frame while the original loads. */}
      {thumb && !loaded ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" aria-hidden className="absolute max-h-full max-w-full object-contain" style={{ aspectRatio: ratio }} />
      ) : null}
      {full ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={full}
          alt={g.title}
          onLoad={() => setLoaded(true)}
          className="relative max-h-full max-w-full object-contain transition-opacity duration-300"
          style={{ opacity: loaded ? 1 : 0 }}
        />
      ) : null}
    </div>
  );
}
