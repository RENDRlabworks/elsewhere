"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Heart, LoaderCircle, Star, X } from "lucide-react";
import type { Generation } from "@/lib/domain/schemas";
import { assetSrc } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  deletePermanently,
  downloadGeneration,
  isActive,
  setReviewStatus,
  STATUS_LABEL,
  toggleFavorite,
  useCollectionPicker,
} from "./actions";

export function GenerationContextMenu({
  generation: g,
  children,
  extra,
}: {
  generation: Generation;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const picker = useCollectionPicker();
  const done = g.status === "completed" && !!g.assetId;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={() => router.push(`/studio?generation=${g.id}`)}>Open in Studio</ContextMenuItem>
        {g.sceneSnapshot ? (
          <ContextMenuItem onSelect={() => router.push(`/studio?restore=${g.id}`)}>Restore scene settings</ContextMenuItem>
        ) : null}
        {extra}
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!done} onSelect={() => void toggleFavorite(g)}>
          {g.favorite ? "Remove favorite" : "Favorite"}
          <ContextMenuShortcut>F</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!done} onSelect={() => void setReviewStatus(g, g.reviewStatus === "accepted" ? "unreviewed" : "accepted")}>
          {g.reviewStatus === "accepted" ? "Clear acceptance" : "Accept"}
          <ContextMenuShortcut>A</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!done} onSelect={() => void setReviewStatus(g, g.reviewStatus === "rejected" ? "unreviewed" : "rejected")}>
          {g.reviewStatus === "rejected" ? "Un-reject" : "Reject"}
          <ContextMenuShortcut>X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!done} onSelect={() => picker.show([g.id])}>Add to collection…</ContextMenuItem>
        <ContextMenuItem disabled={!done} onSelect={() => downloadGeneration(g)}>Download original</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" disabled={isActive(g.status)} onSelect={() => void deletePermanently(g)}>
          Delete permanently…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function GenerationTile({
  generation: g,
  onOpen,
  selected,
  onToggleSelect,
  selectable,
  aspect = "natural",
  className,
  showMeta = true,
  priority,
}: {
  generation: Generation;
  onOpen?: () => void;
  selected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  selectable?: boolean;
  aspect?: "natural" | "square" | "portrait";
  className?: string;
  showMeta?: boolean;
  priority?: boolean;
}) {
  const src = assetSrc(g.assetId, "thumb");
  const ratio = aspect === "square" ? "1 / 1" : aspect === "portrait" ? "4 / 5" : g.width && g.height ? `${g.width} / ${g.height}` : "4 / 5";
  return (
    <GenerationContextMenu generation={g}>
      <div className={cn("group relative", className)}>
        <button
          type="button"
          onClick={(e) => {
            if ((e.metaKey || e.ctrlKey || e.shiftKey) && onToggleSelect) onToggleSelect(e);
            else onOpen?.();
          }}
          className={cn(
            "relative block w-full overflow-hidden rounded-md bg-surface outline-none ring-offset-2 ring-offset-background focus-visible:ring-1 focus-visible:ring-text-secondary",
            selected && "ring-1 ring-foreground",
            g.reviewStatus === "rejected" && "opacity-45",
          )}
          style={{ aspectRatio: ratio }}
          aria-label={`Open ${g.title}`}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={g.title}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
            />
          ) : (
            <TileState status={g.status} error={g.errorMessage} />
          )}
          {g.isDevPlaceholder ? (
            <span className="absolute top-2 left-2 rounded-sm bg-black/70 px-1.5 py-0.5 font-mono text-[9.5px] tracking-wide text-warning uppercase">
              Dev sketch
            </span>
          ) : null}
          <span className="absolute top-2 right-2 flex gap-1">
            {g.favorite ? <Heart className="size-3.5 fill-foreground text-foreground drop-shadow" /> : null}
            {g.reviewStatus === "accepted" ? <Check className="size-3.5 text-success drop-shadow" /> : null}
            {g.reviewStatus === "rejected" ? <X className="size-3.5 text-danger drop-shadow" /> : null}
          </span>
        </button>
        {selectable ? (
          <button
            type="button"
            onClick={onToggleSelect}
            aria-label={selected ? "Deselect" : "Select"}
            aria-pressed={selected}
            className={cn(
              "absolute bottom-2 left-2 flex size-5 items-center justify-center rounded-sm border transition-opacity",
              selected ? "border-foreground bg-foreground text-background opacity-100" : "border-white/50 bg-black/40 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            {selected ? <Check className="size-3" /> : null}
          </button>
        ) : null}
        {showMeta ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="truncate text-[12px] text-text-secondary">{g.title}</div>
            {g.rating ? (
              <div className="flex shrink-0 items-center gap-0.5 text-[11px] text-text-muted">
                <Star className="size-3" /> {g.rating}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </GenerationContextMenu>
  );
}

export function TileState({ status, error }: { status: Generation["status"]; error?: string | null }) {
  if (isActive(status)) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface">
        <LoaderCircle className="size-4 animate-spin text-text-muted" />
        <span className="label-meta">{STATUS_LABEL[status]}</span>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface px-4 text-center">
      <CircleAlert className={cn("size-4", status === "failed" ? "text-danger" : "text-text-muted")} />
      <span className="label-meta">{STATUS_LABEL[status]}</span>
      {error ? <span className="line-clamp-3 text-[11px] text-text-muted">{error}</span> : null}
    </div>
  );
}
