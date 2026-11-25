"use client";

import { fitForUpload } from "@/lib/client/upload";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LoaderCircle, PenLine, Upload } from "lucide-react";
import type { CollectionItemView } from "@/lib/services/collections";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { aspectOf, refreshCollections, sceneHexes } from "./lib";

/** Upload an original artwork into a seeded scene slot. */
export function useImportOriginal(collectionId: string, itemId: string) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const pick = () => inputRef.current?.click();
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append("file", await fitForUpload(file, { maxEdge: 4096 }));
    try {
      await api(`/api/collections/${collectionId}/items/${itemId}/import`, { method: "POST", form });
      refreshCollections();
      toast.success("Original imported");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const input = <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onChange} tabIndex={-1} aria-hidden />;
  return { pick, busy, input };
}

/** Five quiet bands of a scene's palette. */
export function PaletteBands({ hexes, vertical, className }: { hexes: string[]; vertical?: boolean; className?: string }) {
  if (!hexes.length) return <div className={cn("bg-elevated", className)} />;
  return (
    <div className={cn("flex overflow-hidden", vertical ? "flex-col" : "flex-row", className)} aria-hidden>
      {hexes.map((h, i) => (
        <div key={`${h}-${i}`} className="flex-1" style={{ background: h }} />
      ))}
    </div>
  );
}

/**
 * An intentional empty frame for a seeded scene awaiting its original artwork.
 * Never shows a stock or generated substitute.
 */
export function SceneSlot({
  item,
  number,
  collectionId,
  variant = "tile",
  ratio,
  className,
}: {
  item: CollectionItemView;
  number: string;
  collectionId: string;
  variant?: "tile" | "compact" | "large";
  /** Override the scene's aspect ratio, e.g. "1 / 1" in a uniform grid. */
  ratio?: string;
  className?: string;
}) {
  const scene = item.scene;
  const { pick, busy, input } = useImportOriginal(collectionId, item.id);
  const hexes = sceneHexes(scene);
  const title = scene?.title ?? "Untitled scene";
  const compact = variant === "compact";
  const large = variant === "large";

  return (
    <div
      className={cn("relative flex flex-col overflow-hidden rounded-md border border-border bg-surface", className)}
      style={{ aspectRatio: ratio ?? aspectOf(scene?.output.aspectRatio) }}
      aria-label={`Scene ${number}: ${title}, awaiting original artwork`}
      role="group"
    >
      {input}
      <PaletteBands hexes={hexes} className={cn("shrink-0 opacity-80", large ? "h-2" : "h-1.5")} />
      <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "p-3.5" : large ? "p-10" : "p-5")}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-text-muted tabular-nums">No. {number}</span>
          <span className="label-meta">Awaiting original</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center py-3">
          <div className={cn("text-editorial text-foreground", compact ? "line-clamp-2 text-[14px] leading-5" : large ? "text-[26px] leading-8" : "text-[18px] leading-6")}>
            {title}
          </div>
          {!compact && scene?.description ? (
            <p className={cn("mt-2 text-text-muted", large ? "max-w-md text-[13px] leading-relaxed" : "line-clamp-4 text-[12px] leading-relaxed")}>
              {scene.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size={compact ? "xs" : "sm"} variant="secondary" onClick={pick} disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Upload />}
            {busy ? "Importing…" : "Import original"}
          </Button>
          {item.sceneId ? (
            compact ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild size="icon-xs" variant="ghost" className="text-text-secondary">
                    <Link href={`/studio?scene=${item.sceneId}`} aria-label="Open scene in Create">
                      <PenLine />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open scene in Create</TooltipContent>
              </Tooltip>
            ) : (
              <Button asChild size="sm" variant="ghost" className="text-text-secondary">
                <Link href={`/studio?scene=${item.sceneId}`}>
                  <PenLine /> Open scene in Create
                </Link>
              </Button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
