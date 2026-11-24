"use client";

import * as React from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, LoaderCircle, PenLine, Star, Upload, X } from "lucide-react";
import type { CollectionView, Generation } from "@/lib/domain/schemas";
import type { CollectionItemView } from "@/lib/services/collections";
import { assetSrc } from "@/lib/client/api";
import { cn, formatDate } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { GenerationContextMenu, GenerationTile, TileState } from "@/components/generation/generation-tile";
import { PaletteBands, SceneSlot, useImportOriginal } from "./scene-slot";
import { sceneHexes } from "./lib";

export type Entry = { item: CollectionItemView; number: string };

type Common = {
  collectionId: string;
  entries: Entry[];
  sortable: boolean;
  selected: Set<string>;
  onToggleSelect: (itemId: string, e: { shiftKey: boolean }) => void;
  onOpen: (itemId: string) => void;
};

export function CollectionItems({
  view,
  onReorder,
  ...common
}: Common & { view: CollectionView; onReorder: (activeId: string, overId: string) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) onReorder(String(e.active.id), String(e.over.id));
  };
  const ids = common.entries.map((e) => e.item.id);

  if (view === "filmstrip") return <FilmstripView {...common} />;
  if (view === "masonry") return <MasonryView {...common} />;

  const body = view === "list" ? <ListView {...common} /> : view === "editorial" ? <EditorialView {...common} /> : <GridView {...common} />;
  if (!common.sortable) return body;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: "To reorder, press space or enter to pick up the image, use the arrow keys to move it, then press space or enter to drop it. Press escape to cancel.",
        },
      }}
    >
      <SortableContext items={ids} strategy={view === "list" ? verticalListSortingStrategy : rectSortingStrategy}>
        {body}
      </SortableContext>
    </DndContext>
  );
}

/* -------------------------------------------------------------------------- */
/* Sortable plumbing                                                           */
/* -------------------------------------------------------------------------- */

type SortableBits = { handle: React.ReactNode; onPointerDown?: React.PointerEventHandler };

function Sortable({
  id,
  enabled,
  className,
  children,
  label,
  handleClassName,
}: {
  id: string;
  enabled: boolean;
  className?: string;
  label: string;
  handleClassName?: string;
  children: (bits: SortableBits) => React.ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id, disabled: !enabled });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };
  const handle = enabled ? (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler | undefined}
      aria-label={`Reorder ${label}`}
      className={cn(
        "flex size-6 cursor-grab items-center justify-center rounded-sm text-text-muted outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-text-secondary active:cursor-grabbing",
        handleClassName,
      )}
    >
      <GripVertical className="size-3.5" />
    </button>
  ) : null;
  return (
    <div ref={setNodeRef} style={style} className={cn(className, isDragging && "opacity-80")}>
      {children({ handle, onPointerDown: enabled ? (listeners?.onPointerDown as React.PointerEventHandler) : undefined })}
    </div>
  );
}

const overlayHandle =
  "absolute right-2 bottom-2 bg-black/55 text-white/80 opacity-0 backdrop-blur-none group-hover/img:opacity-100 focus-visible:opacity-100";

/* -------------------------------------------------------------------------- */
/* Image cell                                                                  */
/* -------------------------------------------------------------------------- */

function ImageCell({
  entry,
  aspect,
  caption,
  bits,
  ...p
}: Omit<Common, "entries" | "sortable" | "collectionId"> & {
  entry: Entry;
  aspect: "natural" | "square";
  caption: "full" | "short";
  bits?: SortableBits;
}) {
  const g = entry.item.generation!;
  const id = entry.item.id;
  return (
    <div onPointerDown={bits?.onPointerDown}>
      <div className="group/img relative">
        <GenerationTile
          generation={g}
          aspect={aspect}
          showMeta={false}
          selectable
          selected={p.selected.has(id)}
          onToggleSelect={(e) => p.onToggleSelect(id, e)}
          onOpen={() => p.onOpen(id)}
        />
        {bits?.handle}
      </div>
      <div className={cn("flex items-baseline gap-2.5", caption === "full" ? "mt-3" : "mt-2")}>
        <span className="shrink-0 font-mono text-[10.5px] text-text-muted tabular-nums">{entry.number}</span>
        <span className={cn("min-w-0 flex-1 truncate", caption === "full" ? "text-[13px] text-foreground" : "text-[12px] text-text-secondary")}>{g.title}</span>
        {g.rating ? (
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-text-muted">
            <Star className="size-3" /> {g.rating}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function isSlot(e: Entry) {
  return !e.item.generation;
}

/* -------------------------------------------------------------------------- */
/* Views                                                                       */
/* -------------------------------------------------------------------------- */

function MasonryView({ entries, collectionId, ...p }: Common) {
  return (
    <div style={{ columnWidth: 260, columnGap: 28 }}>
      {entries.map((e) => (
        <div key={e.item.id} className="mb-8 break-inside-avoid">
          {isSlot(e) ? (
            <SceneSlot item={e.item} number={e.number} collectionId={collectionId} />
          ) : (
            <ImageCell entry={e} aspect="natural" caption="short" {...p} />
          )}
        </div>
      ))}
    </div>
  );
}

function GridView({ entries, collectionId, sortable, ...p }: Common) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-5 gap-y-8">
      {entries.map((e) => (
        <Sortable key={e.item.id} id={e.item.id} enabled={sortable} label={labelOf(e)} handleClassName={overlayHandle}>
          {(bits) =>
            isSlot(e) ? (
              <div className="group/img relative" onPointerDown={bits.onPointerDown}>
                <SceneSlot item={e.item} number={e.number} collectionId={collectionId} variant="compact" ratio="1 / 1" />
                {bits.handle}
              </div>
            ) : (
              <ImageCell entry={e} aspect="square" caption="short" bits={bits} {...p} />
            )
          }
        </Sortable>
      ))}
    </div>
  );
}

function EditorialView({ entries, collectionId, sortable, ...p }: Common) {
  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-x-14 gap-y-16 md:grid-cols-2">
      {entries.map((e) => (
        <Sortable key={e.item.id} id={e.item.id} enabled={sortable} label={labelOf(e)} handleClassName={overlayHandle}>
          {(bits) =>
            isSlot(e) ? (
              <div className="group/img relative" onPointerDown={bits.onPointerDown}>
                <SceneSlot item={e.item} number={e.number} collectionId={collectionId} />
                {bits.handle}
              </div>
            ) : (
              <ImageCell entry={e} aspect="natural" caption="full" bits={bits} {...p} />
            )
          }
        </Sortable>
      ))}
    </div>
  );
}

function labelOf(e: Entry) {
  return e.item.generation?.title ?? e.item.scene?.title ?? `item ${e.number}`;
}

const LIST_COLS = "grid grid-cols-[28px_28px_64px_minmax(0,1fr)_88px_108px_minmax(0,150px)_104px] items-center gap-3";

function ListView({ entries, collectionId, sortable, ...p }: Common) {
  return (
    <div role="table" aria-label="Collection items" className="text-[12.5px]">
      <div role="row" className={cn(LIST_COLS, "border-b border-border pb-2")}>
        <span role="columnheader">
          <span className="sr-only">Order</span>
        </span>
        <span role="columnheader">
          <span className="sr-only">Select</span>
        </span>
        <span role="columnheader" className="label-meta">
          No.
        </span>
        <span role="columnheader" className="label-meta">
          Title
        </span>
        <span role="columnheader" className="label-meta">
          Rating
        </span>
        <span role="columnheader" className="label-meta">
          Review
        </span>
        <span role="columnheader" className="label-meta">
          Model
        </span>
        <span role="columnheader" className="label-meta text-right">
          Date
        </span>
      </div>
      {entries.map((e) => (
        <Sortable key={e.item.id} id={e.item.id} enabled={sortable} label={labelOf(e)}>
          {(bits) =>
            isSlot(e) ? (
              <SlotRow entry={e} collectionId={collectionId} handle={bits.handle} />
            ) : (
              <ImageRow entry={e} handle={bits.handle} {...p} />
            )
          }
        </Sortable>
      ))}
    </div>
  );
}

function ImageRow({ entry, handle, ...p }: Omit<Common, "entries" | "sortable" | "collectionId"> & { entry: Entry; handle: React.ReactNode }) {
  const g = entry.item.generation!;
  const id = entry.item.id;
  const selected = p.selected.has(id);
  const thumb = assetSrc(g.assetId, "thumb");
  return (
    <GenerationContextMenu generation={g}>
      <div
        role="row"
        aria-selected={selected}
        className={cn(LIST_COLS, "group border-b border-border py-2 transition-colors hover:bg-surface", selected && "bg-surface")}
      >
        <span role="cell">{handle}</span>
        <span role="cell" className="flex items-center justify-center">
          <Checkbox
            checked={selected}
            onClick={(e) => {
              e.preventDefault();
              p.onToggleSelect(id, e);
            }}
            aria-label={`Select ${g.title}`}
          />
        </span>
        <span role="cell" className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={(e) => (e.shiftKey || e.metaKey || e.ctrlKey ? p.onToggleSelect(id, e) : p.onOpen(id))}
            aria-label={`Open ${g.title}`}
            className={cn("relative h-12 w-10 shrink-0 overflow-hidden rounded-sm bg-elevated outline-none focus-visible:ring-1 focus-visible:ring-text-secondary", g.reviewStatus === "rejected" && "opacity-45")}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
            ) : (
              <TileState id={g.id} status={g.status} />
            )}
          </button>
          <span className="font-mono text-[10.5px] text-text-muted tabular-nums">{entry.number}</span>
        </span>
        <span role="cell" className="min-w-0">
          <button type="button" onClick={() => p.onOpen(id)} className="block max-w-full truncate text-left text-foreground outline-none hover:underline hover:underline-offset-4 focus-visible:underline">
            {g.title}
          </button>
          {g.environment ? <span className="block truncate text-[11.5px] text-text-muted">{g.environment}</span> : null}
        </span>
        <span role="cell" className="flex items-center gap-px" aria-label={g.rating ? `${g.rating} of 5 stars` : "Not rated"}>
          {g.rating ? (
            Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("size-3", i < g.rating ? "fill-text-secondary text-text-secondary" : "text-border")} strokeWidth={1.5} />)
          ) : (
            <span className="text-text-muted">Unrated</span>
          )}
        </span>
        <span role="cell">
          <ReviewLabel status={g.reviewStatus} />
        </span>
        <span role="cell" className="truncate font-mono text-[11px] text-text-muted" title={g.model ?? undefined}>
          {g.source === "imported" ? "Imported" : (g.model ?? "n/a")}
        </span>
        <span role="cell" className="text-right text-[12px] text-text-muted tabular-nums">
          {formatDate(g.createdAt)}
        </span>
      </div>
    </GenerationContextMenu>
  );
}

function ReviewLabel({ status }: { status: Generation["reviewStatus"] }) {
  if (status === "accepted")
    return (
      <span className="inline-flex items-center gap-1 text-text-secondary">
        <Check className="size-3 text-success" /> Accepted
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 text-text-muted">
        <X className="size-3 text-danger" /> Rejected
      </span>
    );
  return <span className="text-text-muted">Unreviewed</span>;
}

function SlotRow({ entry, collectionId, handle }: { entry: Entry; collectionId: string; handle: React.ReactNode }) {
  const scene = entry.item.scene;
  const { pick, busy, input } = useImportOriginal(collectionId, entry.item.id);
  return (
    <div role="row" className={cn(LIST_COLS, "border-b border-border py-2")}>
      <span role="cell">{handle}</span>
      <span role="cell" />
      <span role="cell" className="flex items-center gap-2.5">
        <PaletteBands hexes={sceneHexes(scene)} vertical className="h-12 w-10 shrink-0 rounded-sm opacity-70" />
        <span className="font-mono text-[10.5px] text-text-muted tabular-nums">{entry.number}</span>
      </span>
      <span role="cell" className="min-w-0">
        <span className="block truncate text-text-secondary">{scene?.title ?? "Untitled scene"}</span>
        <span className="block truncate text-[11.5px] text-text-muted">{scene?.description}</span>
      </span>
      <span role="cell" className="col-span-2 text-text-muted">
        Awaiting original
      </span>
      <span role="cell" className="col-span-2 flex items-center justify-end gap-1">
        {input}
        <Button size="xs" variant="secondary" onClick={pick} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Upload />} {busy ? "Importing…" : "Import original"}
        </Button>
        {entry.item.sceneId ? (
          <Button asChild size="icon-xs" variant="ghost" className="text-text-muted">
            <Link href={`/studio?scene=${entry.item.sceneId}`} aria-label="Open scene in Studio" title="Open scene in Studio">
              <PenLine />
            </Link>
          </Button>
        ) : null}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Filmstrip                                                                   */
/* -------------------------------------------------------------------------- */

function FilmstripView({ entries, collectionId, ...p }: Common) {
  const [index, setIndex] = React.useState(0);
  const i = Math.min(index, Math.max(0, entries.length - 1));
  const cur = entries[i];
  const stripRef = React.useRef<HTMLDivElement>(null);

  const select = (n: number) => {
    const next = Math.max(0, Math.min(entries.length - 1, n));
    setIndex(next);
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-strip-index="${next}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  };

  if (!cur) return null;
  const g = cur.item.generation;
  const full = g ? assetSrc(g.assetId, "full") : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex h-[min(64vh,760px)] items-center justify-center">
        {g ? (
          full ? (
            <GenerationContextMenu generation={g}>
              <button
                type="button"
                onClick={() => p.onOpen(cur.item.id)}
                aria-label={`View ${g.title} larger`}
                className="flex h-full max-w-full items-center justify-center rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-text-secondary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={g.id}
                  src={full}
                  alt={g.title}
                  className={cn("max-h-full max-w-full rounded-sm object-contain", g.reviewStatus === "rejected" && "opacity-45")}
                  style={{ aspectRatio: g.width && g.height ? `${g.width} / ${g.height}` : undefined }}
                />
              </button>
            </GenerationContextMenu>
          ) : (
            <div className="relative aspect-[4/5] h-full rounded-md bg-surface">
              <TileState id={g.id} status={g.status} error={g.errorMessage} />
            </div>
          )
        ) : (
          <SceneSlot item={cur.item} number={cur.number} collectionId={collectionId} variant="large" className="h-full" />
        )}
      </div>
      <div className="flex items-baseline justify-center gap-3 text-center">
        <span className="font-mono text-[11px] text-text-muted tabular-nums">No. {cur.number}</span>
        <span className="text-editorial text-[17px] text-foreground">{g?.title ?? cur.item.scene?.title}</span>
        <span className="font-mono text-[11px] text-text-muted tabular-nums">
          {i + 1} / {entries.length}
        </span>
      </div>
      <div
        ref={stripRef}
        role="listbox"
        aria-label="Filmstrip"
        aria-orientation="horizontal"
        className="flex gap-2 overflow-x-auto pb-3"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            select(i + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            select(i - 1);
          } else if (e.key === "Home") {
            e.preventDefault();
            select(0);
          } else if (e.key === "End") {
            e.preventDefault();
            select(entries.length - 1);
          } else if (e.key === "Enter" && g) {
            p.onOpen(cur.item.id);
          }
        }}
      >
        {entries.map((e, n) => {
          const t = e.item.generation ? assetSrc(e.item.generation.assetId, "thumb") : null;
          const sel = p.selected.has(e.item.id);
          return (
            <button
              key={e.item.id}
              type="button"
              role="option"
              aria-selected={n === i}
              data-strip-index={n}
              tabIndex={n === i ? 0 : -1}
              onClick={(ev) => {
                if (e.item.generation && (ev.shiftKey || ev.metaKey || ev.ctrlKey)) p.onToggleSelect(e.item.id, ev);
                else select(n);
              }}
              aria-label={labelOf(e)}
              className={cn(
                "relative h-24 shrink-0 overflow-hidden rounded-sm bg-surface outline-none transition-opacity focus-visible:ring-1 focus-visible:ring-text-secondary",
                n === i ? "opacity-100 ring-1 ring-foreground" : "opacity-55 hover:opacity-90",
                sel && "ring-1 ring-text-secondary",
              )}
              style={{
                aspectRatio: e.item.generation?.width && e.item.generation.height ? `${e.item.generation.width} / ${e.item.generation.height}` : "4 / 5",
              }}
            >
              {t ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
              ) : e.item.generation ? null : (
                <PaletteBands hexes={sceneHexes(e.item.scene)} vertical className="absolute inset-0 opacity-60" />
              )}
              {sel ? (
                <span className="absolute bottom-1 left-1 flex size-4 items-center justify-center rounded-sm bg-foreground text-background">
                  <Check className="size-3" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
