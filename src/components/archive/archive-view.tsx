"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive as ArchiveIcon, Check, Download, FolderPlus, Heart, ListChecks, Palette, RotateCcw, SearchX, Star, Trash2, X } from "lucide-react";
import type { Generation } from "@/lib/domain/schemas";
import { api, assetSrc, errorMessage, newIdempotencyKey } from "@/lib/client/api";
import type { CollectionSummary } from "@/lib/services/collections";
import { matchesCollection, plural } from "@/components/collections/lib";
import { invalidate, useResource } from "@/lib/client/resource";
import { useApp, usePreferences } from "@/stores/app";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, IconButton } from "@/components/common/primitives";
import { confirmAction } from "@/components/common/confirm";
import { useShareSheet } from "@/components/share/store";
import { GenerationTile } from "@/components/generation/generation-tile";
import { GENERATION_KEYS, isActive, useCollectionPicker, useStyleReferencePicker } from "@/components/generation/actions";
import { BarButton, SelectionBar } from "@/components/collections/selection-bar";
import { LibraryTabs } from "@/components/common/library-tabs";
import { ArchiveFilters, SearchField } from "./archive-toolbar";
import { apiBase, pageKey, PAGE_SIZE, useArchiveQuery } from "./query";

type Page = { items: Generation[]; total: number };
type Density = "compact" | "comfortable" | "spacious";

const DENSITY_MIN: Record<Density, number> = { compact: 150, comfortable: 210, spacious: 300 };

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

export function ArchiveView() {
  const router = useRouter();
  const { query, update, clear, hasAny } = useArchiveQuery();
  const prefs = usePreferences();
  const updatePreferences = useApp((s) => s.updatePreferences);
  const density: Density = prefs?.ui.galleryDensity ?? "comfortable";
  const picker = useCollectionPicker();
  const showStylePicker = useStyleReferencePicker((s) => s.show);

  /* Search: local while typing, debounced into the URL. */
  const [search, setSearch] = React.useState(query.q);
  const [syncedQ, setSyncedQ] = React.useState(query.q);
  if (query.q !== syncedQ) {
    // The URL changed from elsewhere (clear filters, command palette): follow it.
    setSyncedQ(query.q);
    if (query.q.trim() !== search.trim()) setSearch(query.q);
  }
  React.useEffect(() => {
    if (search.trim() === query.q.trim()) return;
    const t = setTimeout(() => update({ q: search.trim() }), 250);
    return () => clearTimeout(t);
  }, [search, query.q, update]);
  const searchRef = React.useRef<HTMLInputElement>(null);

  /* Paging: a list of page keys, each fetched and cached independently. */
  const base = apiBase(query);
  const [paging, setPaging] = React.useState({ base, count: 1 });
  const pageCount = paging.base === base ? paging.count : 1;
  const keys = React.useMemo(() => Array.from({ length: pageCount }, (_, i) => pageKey(base, i)), [base, pageCount]);
  const [pages, setPages] = React.useState<Record<string, Page>>({});
  const onPage = React.useCallback((key: string, page: Page) => setPages((p) => (p[key] === page ? p : { ...p, [key]: page })), []);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const onError = React.useCallback((key: string, msg: string | null) => setErrors((e) => (e[key] === (msg ?? undefined) ? e : { ...e, [key]: msg ?? "" })), []);

  const first = pages[keys[0]];
  const total = first?.total ?? 0;
  const items = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Generation[] = [];
    for (const k of keys) {
      for (const g of pages[k]?.items ?? []) {
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        out.push(g);
      }
    }
    return out;
  }, [keys, pages]);
  const lastLoaded = !!pages[keys[keys.length - 1]];
  const hasMore = !!first && lastLoaded && pageCount * PAGE_SIZE < total;
  const loadMore = React.useCallback(() => {
    if (hasMore) setPaging({ base, count: pageCount + 1 });
  }, [hasMore, base, pageCount]);
  const firstError = errors[keys[0]];

  /* Keep in-flight images fresh. */
  const anyActive = items.some((g) => isActive(g.status));
  React.useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => invalidate("/api/generations?"), 2500);
    return () => clearInterval(t);
  }, [anyActive]);

  /* Infinite scroll. */
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), {
      root: scrollRef.current,
      rootMargin: "600px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  /* Selection. */
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const anchor = React.useRef<string | null>(null);
  const ids = React.useMemo(() => items.map((g) => g.id), [items]);
  const visibleSelected = React.useMemo(() => new Set([...selected].filter((s) => ids.includes(s))), [selected, ids]);
  const selectedItems = items.filter((g) => visibleSelected.has(g.id));
  const clearSelection = React.useCallback(() => {
    setSelected(new Set());
    anchor.current = null;
  }, []);
  const toggle = (id: string, e: { shiftKey: boolean }) => {
    const from = anchor.current;
    anchor.current = id;
    setSelected((prev) => {
      const next = new Set([...prev].filter((s) => ids.includes(s)));
      if (e.shiftKey && from && ids.includes(from)) {
        const a = ids.indexOf(from);
        const b = ids.indexOf(id);
        for (const x of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(x);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !isTyping(e.target) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "Escape" && !isTyping(e.target)) {
        if (document.querySelector("[role=dialog],[role=menu],[data-radix-popper-content-wrapper]")) return;
        clearSelection();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && !isTyping(e.target)) {
        if (!ids.length) return;
        e.preventDefault();
        setSelected(new Set(ids));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids, clearSelection]);

  /* Bulk actions. */
  const done = selectedItems.filter((g) => g.status === "completed" && g.assetId);

  async function bulkPatch(list: Generation[], patch: Partial<Pick<Generation, "favorite" | "reviewStatus">>) {
    const res = await Promise.allSettled(list.map((g) => api(`/api/generations/${g.id}`, { method: "PATCH", body: patch })));
    invalidate(...GENERATION_KEYS);
    const failed = res.filter((r) => r.status === "rejected").length;
    if (failed) toast.error(`${failed} of ${list.length} could not be updated`);
    return list.length - failed;
  }

  async function review(status: "accepted" | "rejected") {
    const list = done;
    if (!list.length) return;
    const prev = new Map(list.map((g) => [g.id, g.reviewStatus]));
    const n = await bulkPatch(list, { reviewStatus: status });
    if (!n) return;
    toast(status === "rejected" ? `Rejected ${n} image${n === 1 ? "" : "s"}. Rejected images stay in the archive.` : `Accepted ${n} image${n === 1 ? "" : "s"}`, {
      action: {
        label: "Undo",
        onClick: () =>
          void Promise.allSettled(list.map((g) => api(`/api/generations/${g.id}`, { method: "PATCH", body: { reviewStatus: prev.get(g.id) } }))).then(() =>
            invalidate(...GENERATION_KEYS),
          ),
      },
    });
  }

  const allFavorite = done.length > 0 && done.every((g) => g.favorite);
  async function favorite() {
    if (!done.length) return;
    const n = await bulkPatch(done, { favorite: !allFavorite });
    if (n) toast.success(allFavorite ? `Removed ${n} from favorites` : `Added ${n} to favorites`);
  }

  async function removeForever() {
    const list = selectedItems.filter((g) => !isActive(g.status));
    if (!list.length) return;
    const skipped = selectedItems.length - list.length;
    const ok = await confirmAction({
      title: `Delete ${list.length} image${list.length === 1 ? "" : "s"} permanently?`,
      description: `The files are removed from storage, every collection and the history. This cannot be undone. To hide images but keep them, reject them instead.${skipped ? ` ${skipped} still in progress will be skipped.` : ""}`,
      confirmLabel: `Delete ${list.length} permanently`,
      destructive: true,
    });
    if (!ok) return;
    const t = toast.loading(`Deleting ${list.length} image${list.length === 1 ? "" : "s"}`);
    const res = await Promise.allSettled(list.map((g) => api(`/api/generations/${g.id}`, { method: "DELETE" })));
    invalidate(...GENERATION_KEYS);
    clearSelection();
    const failed = res.filter((r) => r.status === "rejected").length;
    if (failed) toast.error(`${list.length - failed} deleted, ${failed} could not be deleted`, { id: t });
    else toast.success(`${list.length} image${list.length === 1 ? "" : "s"} deleted`, { id: t });
  }

  function download() {
    const list = done.map((g) => g.id);
    if (list.length > 200) toast.message("Exporting the first 200. Zip downloads are limited to 200 images at a time.");
    useShareSheet.getState().show({ kind: "images", ids: list.slice(0, 200) });
  }

  const minCol = DENSITY_MIN[density];
  const initialLoading = !first && !firstError;

  return (
    <div className="relative flex h-full flex-col">
      {keys.map((k) => (
        <PageLoader key={k} url={k} onPage={onPage} onError={onError} />
      ))}

      <header className="shrink-0 px-4 pt-5 pb-3 md:px-8 md:pt-8 md:pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
          <div className="min-w-0">
            <h1 className="text-[24px] leading-8 font-medium tracking-[-0.01em] text-foreground">Library</h1>
            <div className="mt-4">
              <LibraryTabs active="images" imageCount={initialLoading ? null : total} q={query.q} />
            </div>
          </div>
          <div className="flex items-center gap-2 md:pb-1.5">
            <SearchField value={search} onChange={setSearch} inputRef={searchRef} />
            <ReviewButton />
            <div className="hidden md:block">
              <DensityToggle value={density} onChange={(d) => void updatePreferences({ ui: { galleryDensity: d } }).catch((err) => toast.error(errorMessage(err)))} />
            </div>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {initialLoading ? "Loading history" : `${total} ${hasAny ? "matching images" : "images in your library"}`}
        </p>
        <div className="-mx-4 mt-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:mt-5 md:overflow-visible md:px-0">
          <ArchiveFilters
            query={query}
            update={update}
            hasAny={hasAny}
            clear={() => {
              setSearch("");
              clear();
            }}
          />
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-32 md:px-8 md:pt-6">
          {query.q.trim() ? <CollectionMatches q={query.q} /> : null}
          {initialLoading ? (
            <Grid min={minCol}>
              {Array.from({ length: 18 }, (_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-[4/5] w-full rounded-md" />
                  {density !== "compact" ? <Skeleton className="mt-2 h-3 w-2/3" /> : null}
                </div>
              ))}
            </Grid>
          ) : firstError && !first ? (
            <EmptyState
              title="The archive could not be loaded"
              description={firstError}
              action={
                <Button size="sm" variant="secondary" onClick={() => invalidate("/api/generations?")}>
                  Try again
                </Button>
              }
            />
          ) : !items.length ? (
            hasAny ? (
              <EmptyState
                icon={SearchX}
                className="py-28"
                title="No images match these filters"
                description="Try a broader search or remove a filter."
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      clear();
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ArchiveIcon}
                className="py-28"
                title="No images yet"
                description="Everything you generate or import is kept here, including rejected and failed attempts."
                action={
                  <Button asChild size="sm">
                    <Link href="/studio">Start creating</Link>
                  </Button>
                }
              />
            )
          ) : (
            <>
              <Grid min={minCol}>
                {items.map((g, i) => (
                  <ArchiveCell
                    key={g.id}
                    g={g}
                    priority={i < 12}
                    showCaption={density !== "compact"}
                    selected={visibleSelected.has(g.id)}
                    onToggleSelect={(e) => toggle(g.id, e)}
                    onOpen={() => router.push(`/studio?generation=${g.id}`)}
                  />
                ))}
              </Grid>
              <div ref={sentinelRef} className="flex justify-center pt-10">
                {hasMore ? (
                  <Button variant="ghost" size="sm" onClick={loadMore} className="text-text-secondary">
                    Load more
                  </Button>
                ) : !lastLoaded ? (
                  <span className="label-meta">Loading…</span>
                ) : items.length > PAGE_SIZE ? (
                  <span className="label-meta">End of archive</span>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      <SelectionBar count={visibleSelected.size} onClear={clearSelection}>
        <BarButton onClick={() => picker.show(done.map((g) => g.id))} disabled={!done.length}>
          <FolderPlus /> Add to collection
        </BarButton>
        <BarButton onClick={() => showStylePicker(done.slice(0, 20).map((g) => g.id))} disabled={!done.length}>
          <Palette /> Use as style references
        </BarButton>
        <BarButton onClick={download} disabled={!done.length}>
          <Download /> Export
        </BarButton>
        <BarButton onClick={() => void review("accepted")} disabled={!done.length}>
          <Check /> Accept
        </BarButton>
        <BarButton onClick={() => void review("rejected")} disabled={!done.length}>
          <X /> Reject
        </BarButton>
        <BarButton onClick={() => void favorite()} disabled={!done.length} aria-pressed={allFavorite}>
          <Heart className={cn(allFavorite && "fill-current")} /> {allFavorite ? "Unfavorite" : "Favorite"}
        </BarButton>
        <BarButton onClick={() => void removeForever()} className="hover:text-danger">
          <Trash2 /> Delete
        </BarButton>
      </SelectionBar>
    </div>
  );
}

function Grid({ min, children }: { min: number; children: React.ReactNode }) {
  return (
    // At least two columns on a phone, however roomy the chosen density.
    <div className="grid gap-x-3 gap-y-5 md:gap-x-4 md:gap-y-6" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, calc(50% - 6px)), 1fr))` }}>
      {children}
    </div>
  );
}

/** Fetches one page into the shared cache and reports it upward. Renders nothing. */
function PageLoader({ url, onPage, onError }: { url: string; onPage: (k: string, p: Page) => void; onError: (k: string, msg: string | null) => void }) {
  const { data, error } = useResource<Page>(url);
  React.useEffect(() => {
    if (data) onPage(url, data);
  }, [data, url, onPage]);
  React.useEffect(() => {
    onError(url, error ? error.message : null);
  }, [error, url, onError]);
  return null;
}

function ArchiveCell({
  g,
  selected,
  onToggleSelect,
  onOpen,
  showCaption,
  priority,
}: {
  g: Generation;
  selected: boolean;
  onToggleSelect: (e: { shiftKey: boolean }) => void;
  onOpen: () => void;
  showCaption: boolean;
  priority?: boolean;
}) {
  const failed = g.status === "failed" || g.status === "cancelled";
  return (
    <div>
      <div className="relative">
        <GenerationTile generation={g} aspect="portrait" showMeta={false} selectable selected={selected} onToggleSelect={onToggleSelect} onOpen={onOpen} priority={priority} />
        {failed && g.jobId ? <RetryButton jobId={g.jobId} /> : null}
      </div>
      {showCaption ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={cn("truncate text-[12px]", g.reviewStatus === "rejected" ? "text-text-muted" : "text-text-secondary")}>{g.title}</span>
          <span className="flex shrink-0 items-center gap-2 text-[11px] text-text-muted">
            {g.rating ? (
              <span className="flex items-center gap-0.5">
                <Star className="size-3" /> {g.rating}
              </span>
            ) : null}
            <span className="tabular-nums">{formatDate(g.createdAt, { month: "short", day: "numeric" })}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function RetryButton({ jobId }: { jobId: string }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <IconButton
      icon={RotateCcw}
      label={busy ? "Retrying" : "Retry generation"}
      size="icon-xs"
      disabled={busy}
      className="absolute right-2 bottom-2 border border-border bg-elevated text-text-secondary hover:bg-interactive"
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          await api(`/api/jobs/${jobId}/retry`, { method: "POST", body: { idempotencyKey: newIdempotencyKey() } });
          invalidate(...GENERATION_KEYS);
          toast.success("Retrying. The new attempt appears at the top of the archive.");
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

function DensityToggle({ value, onChange }: { value: Density; onChange: (d: Density) => void }) {
  const opts: { key: Density; label: string; bars: number }[] = [
    { key: "compact", label: "Compact", bars: 4 },
    { key: "comfortable", label: "Comfortable", bars: 3 },
    { key: "spacious", label: "Spacious", bars: 2 },
  ];
  return (
    <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Grid density">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          aria-label={`${o.label} grid`}
          title={`${o.label} grid`}
          onClick={() => onChange(o.key)}
          className={cn(
            "flex h-6 w-7 items-center justify-center gap-[2px] rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-text-secondary",
            value === o.key ? "bg-interactive" : "hover:bg-surface",
          )}
        >
          {Array.from({ length: o.bars }, (_, i) => (
            <span key={i} className={cn("h-3 rounded-[1px]", value === o.key ? "bg-foreground" : "bg-text-muted", o.bars === 4 ? "w-[2.5px]" : o.bars === 3 ? "w-[3.5px]" : "w-[5px]")} />
          ))}
        </button>
      ))}
    </div>
  );
}

/** Opens triage when there are finished images nobody has kept or rejected yet. */
function ReviewButton() {
  const { data } = useResource<Page>("/api/generations?status=completed&filter=unreviewed&limit=1");
  const count = data?.total ?? 0;
  if (!count) return null;
  return (
    <Button asChild variant="secondary" size="sm" className="h-9 gap-2 rounded-lg px-3">
      <Link href="/archive/review">
        <ListChecks /> Review
        <span className="text-[11.5px] text-text-muted tabular-nums">{count > 199 ? "200+" : count}</span>
      </Link>
    </Button>
  );
}

/** Collections whose name, description or tags match the search, shown above matching images. */
function CollectionMatches({ q }: { q: string }) {
  const { data } = useResource<{ collections: CollectionSummary[] }>("/api/collections");
  const matches = (data?.collections ?? []).filter((c) => matchesCollection(c, q));
  if (!matches.length) return null;
  return (
    <section aria-label="Matching collections" className="mb-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[11px] tracking-[0.08em] text-text-muted uppercase">Collections</h2>
        {matches.length > 4 ? (
          <Link href={`/collections?q=${encodeURIComponent(q.trim())}`} className="text-[12px] text-text-muted hover:text-text-secondary">
            All {matches.length}
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {matches.slice(0, 4).map((c) => {
          const cover = assetSrc(c.coverAssetId, "thumb");
          return (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              className="group flex items-center gap-3 rounded-lg bg-surface p-2 pr-3 outline-none transition-colors hover:bg-elevated focus-visible:ring-1 focus-visible:ring-text-secondary"
            >
              <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-elevated">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {cover ? <img src={cover} alt="" className="size-full object-cover" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] text-foreground">{c.name}</span>
                <span className="block text-[12px] text-text-muted">{plural(c.imageCount, "image")}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
