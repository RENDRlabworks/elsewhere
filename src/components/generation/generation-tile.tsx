"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CircleAlert, Heart, LoaderCircle, Wand2, X } from "lucide-react";
import type { Generation } from "@/lib/domain/schemas";
import { assetSrc } from "@/lib/client/api";
import { shareImage } from "@/components/share/store";
import { GenerationProgressFill, useCompletionHold } from "./progress";
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
  upscaleGeneration,
  useCollectionPicker,
  useStyleReferencePicker,
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
  const stylePicker = useStyleReferencePicker();
  const done = g.status === "completed" && !!g.assetId;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={() => router.push(`/studio?generation=${g.id}`)}>Open in Create</ContextMenuItem>
        {g.sceneSnapshot ? (
          <ContextMenuItem onSelect={() => router.push(`/studio?restore=${g.id}`)}>Restore scene settings</ContextMenuItem>
        ) : null}
        <ContextMenuItem disabled={!done} onSelect={() => router.push(`/studio?recreate=${g.id}`)}>Recreate in this style</ContextMenuItem>
        <ContextMenuItem disabled={!done} onSelect={() => void upscaleGeneration(g, (id) => router.push(`/studio?generation=${id}`))}>Upscale with AI</ContextMenuItem>
        <ContextMenuItem disabled={!done} onSelect={() => stylePicker.show([g.id])}>Use as style reference…</ContextMenuItem>
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
        <ContextMenuItem disabled={!done} onSelect={() => shareImage(g)}>Share or export…</ContextMenuItem>
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
  const holding = useCompletionHold(g);
  const src = holding ? null : assetSrc(g.assetId, "thumb");
  const ratio = aspect === "square" ? "1 / 1" : aspect === "portrait" ? "4 / 5" : g.width && g.height ? `${g.width} / ${g.height}` : "4 / 5";
  return (
    <GenerationContextMenu generation={g}>
      <div className={cn("group", className)}>
        <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            if ((e.metaKey || e.ctrlKey || e.shiftKey) && onToggleSelect) onToggleSelect(e);
            else onOpen?.();
          }}
          className={cn(
            "relative block w-full overflow-hidden rounded-lg bg-surface outline-none ring-offset-2 ring-offset-background focus-visible:ring-1 focus-visible:ring-text-secondary",
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
            <TileState g={g} status={g.status} error={g.errorMessage} />
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
        {showMeta && src ? (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 flex items-end rounded-b-lg bg-gradient-to-t from-black/80 via-black/30 to-transparent pt-10 pr-24 pb-2.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
              selectable ? "pl-9" : "pl-3",
            )}
          >
            <span className="truncate text-[13px] text-white/90">{g.title}</span>
          </span>
        ) : null}
        {g.status === "completed" && g.assetId ? (
          <Link
            href={`/studio?recreate=${g.id}`}
            aria-label={`Recreate ${g.title} in this style`}
            title="Recreate in this style"
            className="absolute right-2 bottom-2 flex h-6 items-center gap-1 rounded-sm bg-black/60 px-1.5 text-[11px] text-white/85 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80 hover:text-white focus-visible:opacity-100"
          >
            <Wand2 className="size-3" /> Recreate
          </Link>
        ) : null}
        </div>
      </div>
    </GenerationContextMenu>
  );
}

export function TileState({ status, error, g }: { status: Generation["status"]; error?: string | null; g?: Generation }) {
  if (g && (isActive(status) || status === "completed")) {
    return (
      <GenerationProgressFill
        g={g}
        inset={12}
        caption={({ percent, label }) => (
          <span className="label-meta absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-sm border border-border bg-surface px-2 py-0.5 whitespace-nowrap tabular-nums">
            {label}
            {percent != null ? ` · ${percent}%` : ""}
          </span>
        )}
      />
    );
  }
  if (isActive(status)) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface">
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
