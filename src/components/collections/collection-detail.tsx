"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChartNoAxesColumn,
  Columns2,
  Copy,
  Download,
  FolderInput,
  GalleryHorizontal,
  ImageIcon,
  LayoutDashboard,
  Grid3x3,
  List,
  MoreHorizontal,
  Palette,
  Play,
  Trash2,
} from "lucide-react";
import { arrayMove } from "@dnd-kit/sortable";
import type { CollectionView, Generation } from "@/lib/domain/schemas";
import type { CollectionSummary } from "@/lib/services/collections";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate, mutateResource, useResource } from "@/lib/client/resource";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, IconButton } from "@/components/common/primitives";
import { useStyleReferencePicker } from "@/components/generation/actions";
import { useShareSheet } from "@/components/share/store";
import { CollectionHeader, saveCollection } from "./collection-header";
import { CollectionItems, type Entry } from "./collection-items";
import { ItemFiltersButton } from "./item-filters";
import { InsightsPanel } from "./insights-panel";
import { Lightbox } from "./lightbox";
import { BarButton, SelectionBar } from "./selection-bar";
import { deleteCollection, duplicateCollection } from "./actions";
import {
  activeFilterCount,
  type CollectionDetailData,
  detailKey,
  EMPTY_FILTERS,
  type ItemFilters,
  matchesFilters,
  plural,
  refreshCollections,
  seriesNumber,
} from "./lib";

const VIEWS: { key: CollectionView; label: string; icon: typeof Grid3x3 }[] = [
  { key: "masonry", label: "Masonry", icon: LayoutDashboard },
  { key: "grid", label: "Uniform grid", icon: Grid3x3 },
  { key: "editorial", label: "Editorial", icon: Columns2 },
  { key: "filmstrip", label: "Filmstrip", icon: GalleryHorizontal },
  { key: "list", label: "List", icon: List },
];

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

export function CollectionDetail({ id }: { id: string }) {
  const router = useRouter();
  const key = detailKey(id);
  const { data, error, loading, reload } = useResource<CollectionDetailData>(key);
  const [filters, setFilters] = React.useState<ItemFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const anchor = React.useRef<string | null>(null);
  const [lightbox, setLightbox] = React.useState<number | null>(null);
  const [insightsOpen, setInsightsOpen] = React.useState(false);

  const collection = data?.collection;
  const items = React.useMemo(() => (data?.items ?? []).filter((i) => i.generation || i.scene), [data]);
  const filterCount = activeFilterCount(filters);

  const allEntries: Entry[] = React.useMemo(() => items.map((item, i) => ({ item, number: seriesNumber(item, i) })), [items]);
  const entries = React.useMemo(
    () => (filterCount ? allEntries.filter((e) => e.item.generation && matchesFilters(e.item.generation, filters)) : allEntries),
    [allEntries, filters, filterCount],
  );
  const generations = React.useMemo(() => items.map((i) => i.generation).filter((g): g is Generation => !!g), [items]);
  const images = React.useMemo(() => entries.filter((e) => e.item.generation?.assetId), [entries]);
  const selectableIds = React.useMemo(() => entries.filter((e) => e.item.generation).map((e) => e.item.id), [entries]);
  const imageCount = generations.filter((g) => g.assetId).length;

  // Drop selections that are no longer visible (removed, moved or filtered out).
  const visibleSelected = React.useMemo(() => new Set([...selected].filter((s) => selectableIds.includes(s))), [selected, selectableIds]);
  const selectedEntries = entries.filter((e) => visibleSelected.has(e.item.id));
  const showStylePicker = useStyleReferencePicker((s) => s.show);
  const styleIds = selectedEntries
    .map((e) => e.item.generation)
    .filter((g) => g?.status === "completed" && g.assetId)
    .map((g) => g!.id)
    .slice(0, 20);

  const view: CollectionView = collection?.viewMode ?? "masonry";
  const sortable = !filterCount && (view === "grid" || view === "editorial" || view === "list") && entries.length > 1;

  const clearSelection = React.useCallback(() => {
    setSelected(new Set());
    anchor.current = null;
  }, []);

  const toggleSelect = (itemId: string, e: { shiftKey: boolean }) => {
    const from = anchor.current;
    anchor.current = itemId;
    setSelected((prev) => {
      const next = new Set([...prev].filter((s) => selectableIds.includes(s)));
      if (e.shiftKey && from && selectableIds.includes(from)) {
        const a = selectableIds.indexOf(from);
        const b = selectableIds.indexOf(itemId);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (const sid of selectableIds.slice(lo, hi + 1)) next.add(sid);
      } else if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightbox !== null) return;
      if (e.key === "Escape" && !isTyping(e.target)) {
        if (document.querySelector("[role=dialog],[role=menu],[data-radix-popper-content-wrapper]")) return;
        clearSelection();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && !isTyping(e.target)) {
        if (!selectableIds.length) return;
        e.preventDefault();
        setSelected(new Set(selectableIds));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, selectableIds, clearSelection]);

  const openItem = (itemId: string) => {
    const idx = images.findIndex((e) => e.item.id === itemId);
    if (idx >= 0) setLightbox(idx);
    else {
      const g = items.find((i) => i.id === itemId)?.generation;
      if (g) router.push(`/studio?generation=${g.id}`);
    }
  };

  async function reorder(activeId: string, overId: string) {
    const ids = (data?.items ?? []).map((i) => i.id);
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const nextIds = arrayMove(ids, from, to);
    mutateResource<CollectionDetailData>(key, (cur) => (cur ? { ...cur, items: arrayMove(cur.items, from, to) } : cur));
    try {
      await api(`/api/collections/${id}/items`, { method: "PUT", body: { itemIds: nextIds } });
      invalidate("/api/collections");
    } catch (err) {
      toast.error(`Order not saved. ${errorMessage(err)}`);
      invalidate(key);
    }
  }

  async function removeSelected() {
    const chosen = selectedEntries;
    if (!chosen.length || !data) return;
    const order = data.items.map((i) => i.generationId ?? i.id);
    const itemIds = chosen.map((e) => e.item.id);
    const genIds = chosen.map((e) => e.item.generationId!).filter(Boolean);
    mutateResource<CollectionDetailData>(key, (cur) => (cur ? { ...cur, items: cur.items.filter((i) => !itemIds.includes(i.id)) } : cur));
    clearSelection();
    try {
      await api(`/api/collections/${id}/items`, { method: "DELETE", body: { itemIds } });
      refreshCollections();
      toast(`Removed ${plural(itemIds.length, "image")} from the collection. ${itemIds.length === 1 ? "It stays" : "They stay"} in the archive.`, {
        action: { label: "Undo", onClick: () => void restore(genIds, order) },
      });
    } catch (err) {
      toast.error(errorMessage(err));
      invalidate(key);
    }
  }

  /** Re-add removed images and put them back where they were. */
  async function restore(genIds: string[], previousOrder: string[]) {
    try {
      await api(`/api/collections/${id}/items`, { method: "POST", body: { generationIds: genIds } });
      const fresh = await api<CollectionDetailData>(`/api/collections/${id}`);
      const byKey = new Map(fresh.items.map((i) => [i.generationId ?? i.id, i.id]));
      const itemIds = previousOrder.map((k) => byKey.get(k)).filter((x): x is string => !!x);
      if (itemIds.length) await api(`/api/collections/${id}/items`, { method: "PUT", body: { itemIds } });
      refreshCollections();
      toast.success("Restored");
    } catch (err) {
      toast.error(errorMessage(err));
      refreshCollections();
    }
  }

  async function moveSelected(target: CollectionSummary) {
    const itemIds = selectedEntries.map((e) => e.item.id);
    if (!itemIds.length) return;
    try {
      const res = await api<{ added: number; skipped: number }>(`/api/collections/${id}/items`, {
        method: "PATCH",
        body: { itemIds, targetCollectionId: target.id },
      });
      clearSelection();
      refreshCollections();
      toast.success(`Moved ${plural(itemIds.length, "image")} to ${target.name}${res.skipped ? `. ${res.skipped} already there.` : ""}`, {
        action: { label: "Open", onClick: () => router.push(`/collections/${target.id}`) },
      });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function setCover() {
    const g = selectedEntries[0]?.item.generation;
    if (!g || !collection) return;
    const res = await saveCollection(id, { coverGenerationId: g.id });
    if (res) toast.success(`"${g.title}" is now the cover`);
  }

  if (loading) return <DetailSkeleton />;
  if (!collection) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          title={error ? "This collection could not be opened" : "Collection not found"}
          description={error?.message ?? "It may have been deleted."}
          action={
            <div className="flex gap-2">
              {error ? (
                <Button size="sm" variant="secondary" onClick={() => void reload()}>
                  Try again
                </Button>
              ) : null}
              <Button asChild size="sm" variant="ghost">
                <Link href="/collections">All collections</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const coverId = collection.coverGenerationId;
  const single = selectedEntries.length === 1 ? selectedEntries[0].item.generation : null;

  return (
    <div className="flex h-full">
      <div className="@container relative flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[12.5px]">
            <Link href="/collections" className="text-text-muted hover:text-foreground">
              Collections
            </Link>
            <span className="text-border">/</span>
            <span className="truncate text-text-secondary">{collection.name}</span>
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton icon={ChartNoAxesColumn} label={insightsOpen ? "Hide insights" : "Show insights"} active={insightsOpen} onClick={() => setInsightsOpen((o) => !o)} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="sm" className={cn("text-text-secondary hover:text-foreground", !imageCount && "opacity-50")} aria-disabled={!imageCount}>
                  <Link href={`/collections/${id}/present`} onClick={(e) => !imageCount && e.preventDefault()}>
                    <Play /> Present
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{imageCount ? "Fullscreen presentation" : "Add images to present this collection"}</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Collection actions" className="text-text-secondary hover:text-foreground">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled={!imageCount} onSelect={() => useShareSheet.getState().show({ kind: "collection", id, name: collection.name, count: imageCount })}>
                  <Download /> Export collection…
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void duplicateCollection(collection, (nid) => router.push(`/collections/${nid}`))}>
                  <Copy /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={async () => {
                    if (await deleteCollection(collection)) router.push("/collections");
                  }}
                >
                  <Trash2 /> Delete collection…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" id="collection-scroll">
          <CollectionHeader collection={collection} imageCount={imageCount} itemCount={items.length} />

          {/* Toolbar */}
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between gap-4 border-y border-border bg-background px-10">
            <div className="flex min-w-0 items-center gap-3 text-[12px] whitespace-nowrap text-text-muted">
              {filterCount ? (
                <>
                  <span className="text-text-secondary">
                    Showing {entries.length} of {plural(generations.length, "image")}
                  </span>
                  <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-text-muted underline-offset-4 hover:text-foreground hover:underline">
                    Clear filters
                  </button>
                </>
              ) : (
                <span className="text-text-secondary">{plural(items.length, "item")}</span>
              )}
              {selectableIds.length ? (
                <button
                  type="button"
                  onClick={() => (visibleSelected.size === selectableIds.length ? clearSelection() : setSelected(new Set(selectableIds)))}
                  className="text-text-muted underline-offset-4 hover:text-foreground hover:underline"
                >
                  {visibleSelected.size === selectableIds.length ? "Deselect all" : "Select all"}
                </button>
              ) : null}
              {entries.length > 1 ? (
                <span className="hidden truncate text-[11.5px] text-text-muted/80 @3xl:inline">
                  {sortable ? "Drag the handle to reorder" : filterCount ? "Clear filters to reorder" : view === "masonry" || view === "filmstrip" ? "Reorder in grid, editorial or list view" : ""}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ItemFiltersButton value={filters} onChange={setFilters} generations={generations} />
              <span className="h-5 w-px bg-border" aria-hidden />
              <ToggleGroup
                type="single"
                size="sm"
                value={view}
                onValueChange={(v) => v && void saveCollection(id, { viewMode: v as CollectionView })}
                aria-label="View mode"
                spacing={0}
                className="gap-0.5"
              >
                {VIEWS.map((v) => (
                  <Tooltip key={v.key}>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem value={v.key} aria-label={v.label} className="size-7 min-w-7 rounded-md! px-0 text-text-muted data-[state=on]:bg-interactive data-[state=on]:text-foreground">
                        <v.icon strokeWidth={1.75} />
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent>{v.label}</TooltipContent>
                  </Tooltip>
                ))}
              </ToggleGroup>
            </div>
          </div>

          <div className="px-10 pt-8 pb-32">
            {!items.length ? (
              <EmptyState
                icon={ImageIcon}
                className="py-24"
                title="This collection is empty"
                description="Select images in the Library or in Create and choose Add to collection. They will appear here in the order you add them."
                action={
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/archive">Browse the archive</Link>
                  </Button>
                }
              />
            ) : !entries.length ? (
              <EmptyState
                className="py-24"
                title="No images match these filters"
                description="Loosen a filter or clear them to see the whole series."
                action={
                  <Button size="sm" variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <CollectionItems
                view={view}
                collectionId={id}
                entries={entries}
                sortable={sortable}
                selected={visibleSelected}
                onToggleSelect={toggleSelect}
                onOpen={openItem}
                onReorder={(a, b) => void reorder(a, b)}
              />
            )}
          </div>
        </div>

        <SelectionBar count={visibleSelected.size} onClear={clearSelection}>
          <BarButton onClick={() => useShareSheet.getState().show({ kind: "images", ids: selectedEntries.map((e) => e.item.generation!.id) })}>
            <Download /> Export
          </BarButton>
          <BarButton onClick={() => showStylePicker(styleIds)} disabled={!styleIds.length}>
            <Palette /> Use as style references
          </BarButton>
          <MoveMenu currentId={id} onMove={(c) => void moveSelected(c)} />
          {single ? (
            <BarButton onClick={() => void setCover()} disabled={single.id === coverId || !single.assetId}>
              <ImageIcon /> {single.id === coverId ? "Cover" : "Set as cover"}
            </BarButton>
          ) : null}
          <BarButton onClick={() => void removeSelected()} className="hover:text-danger">
            <Trash2 /> Remove
          </BarButton>
        </SelectionBar>
      </div>

      {insightsOpen ? <InsightsPanel collectionId={id} onClose={() => setInsightsOpen(false)} /> : null}

      <Lightbox
        images={images.map((e) => e.item.generation!)}
        index={lightbox}
        onIndexChange={setLightbox}
        onClose={() => setLightbox(null)}
        numberFor={(g) => images.find((e) => e.item.generation?.id === g.id)?.number ?? null}
      />
    </div>
  );
}

function MoveMenu({ currentId, onMove }: { currentId: string; onMove: (c: CollectionSummary) => void }) {
  const [open, setOpen] = React.useState(false);
  const { data } = useResource<{ collections: CollectionSummary[] }>(open ? "/api/collections" : null);
  const others = (data?.collections ?? []).filter((c) => c.id !== currentId);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <BarButton>
          <FolderInput /> Move to
        </BarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" className="max-h-72 w-60 overflow-y-auto">
        <DropdownMenuLabel className="text-[11.5px] text-text-muted">Move to collection</DropdownMenuLabel>
        {!data ? <div className="px-2 py-1.5 text-[12px] text-text-muted">Loading…</div> : null}
        {data && !others.length ? <div className="px-2 py-1.5 text-[12px] text-text-muted">No other collections yet.</div> : null}
        {others.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => onMove(c)}>
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            <span className="font-mono text-[11px] text-text-muted tabular-nums">{c.imageCount}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Loading collection">
      <div className="h-12 border-b border-border" />
      <div className="px-10 pt-10">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-8 w-96" />
        <Skeleton className="mt-3 h-4 w-[32rem]" />
        <Skeleton className="mt-6 h-3 w-80" />
      </div>
      <div className={cn("mt-10 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-7 border-t border-border px-10 pt-8")}>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5] w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
