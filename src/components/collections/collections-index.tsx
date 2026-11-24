"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Layers, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import type { CollectionSummary } from "@/lib/services/collections";
import { assetSrc } from "@/lib/client/api";
import { useResource } from "@/lib/client/resource";
import { useProfiles } from "@/stores/app";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, MetaLabel, PageHeader } from "@/components/common/primitives";
import { LibraryTabs } from "@/components/common/library-tabs";
import { NewCollectionDialog } from "./new-collection-dialog";
import { deleteCollection, duplicateCollection } from "./actions";
import { plural } from "./lib";

export function CollectionsIndex() {
  const router = useRouter();
  const { data, error, loading, reload } = useResource<{ collections: CollectionSummary[] }>("/api/collections");
  const [creating, setCreating] = React.useState(false);
  const collections = data?.collections ?? [];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Library"
        description="Curated visual series. Each one is a sequence with an order, a cover and a point of view."
        tabs={<LibraryTabs active="collections" />}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> New collection
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-8 py-8">
          {loading ? (
            <Grid>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-[4/5] w-full rounded-md" />
                  <Skeleton className="mt-4 h-5 w-2/3" />
                  <Skeleton className="mt-2 h-3.5 w-1/3" />
                </div>
              ))}
            </Grid>
          ) : error && !data ? (
            <EmptyState
              title="Collections could not be loaded"
              description={error.message}
              action={
                <Button variant="secondary" size="sm" onClick={() => void reload()}>
                  Try again
                </Button>
              }
            />
          ) : collections.length === 0 ? (
            <EmptyState
              icon={Layers}
              className="py-28"
              title="No collections yet"
              description="A collection is a curated series with its own order and cover. Start one, then add images from Create or the Library."
              action={
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus /> New collection
                </Button>
              }
            />
          ) : (
            <Grid>
              {collections.map((c, i) => (
                <CollectionCard key={c.id} collection={c} priority={i < 4} onOpen={(id) => router.push(`/collections/${id}`)} />
              ))}
            </Grid>
          )}
        </div>
      </div>
      <NewCollectionDialog open={creating} onOpenChange={setCreating} onCreated={(c) => router.push(`/collections/${c.id}`)} />
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-8 gap-y-12">{children}</div>;
}

function CollectionCard({ collection: c, priority, onOpen }: { collection: CollectionSummary; priority?: boolean; onOpen: (id: string) => void }) {
  const profiles = useProfiles();
  const profile = c.styleProfileId ? profiles.find((p) => p.id === c.styleProfileId) : null;
  const cover = assetSrc(c.coverAssetId, "thumb");
  const openSlots = c.itemCount - c.imageCount;

  return (
    <article className="group relative">
      <Link
        href={`/collections/${c.id}`}
        className="block rounded-md outline-none focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        aria-label={`Open ${c.name}`}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-surface">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.012]"
            />
          ) : (
            <div className="absolute inset-4 flex items-center justify-center rounded-sm border border-border">
              <span className="label-meta">{c.itemCount ? `${plural(c.itemCount, "slot")} awaiting images` : "No images yet"}</span>
            </div>
          )}
        </div>
      </Link>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <MetaLabel className="mb-1 h-3.5 truncate">{profile?.name ?? (c.isSeed ? "Seed series" : "")}</MetaLabel>
          <h2 className="truncate text-editorial text-[18px] leading-6 text-foreground">
            <Link href={`/collections/${c.id}`} className="outline-none hover:underline hover:underline-offset-4 focus-visible:underline">
              {c.name}
            </Link>
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-text-muted">
            <span>{plural(c.imageCount, "image")}</span>
            {c.targetCount ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono text-[11.5px] tabular-nums">
                  {c.imageCount} of {c.targetCount}
                </span>
              </>
            ) : openSlots > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{plural(openSlots, "open slot")}</span>
              </>
            ) : null}
          </div>
          <div className="mt-0.5 text-[11.5px] text-text-muted">Updated {formatDate(c.updatedAt)}</div>
          {c.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.tags.slice(0, 5).map((t) => (
                <span key={t} className="rounded-sm border border-border px-1.5 py-px text-[11px] text-text-secondary">
                  {t}
                </span>
              ))}
              {c.tags.length > 5 ? <span className="text-[11px] text-text-muted">+{c.tags.length - 5}</span> : null}
            </div>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`} className="-mr-1.5 shrink-0 text-text-muted hover:text-foreground">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => onOpen(c.id)}>
              <ExternalLink /> Open
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void duplicateCollection(c, onOpen)}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => void deleteCollection(c)}>
              <Trash2 /> Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
