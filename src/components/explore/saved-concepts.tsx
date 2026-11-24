"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, Bookmark, Trash2 } from "lucide-react";
import type { Scene } from "@/lib/domain/schemas";
import { sceneToConcept } from "@/lib/explore/engine";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate, mutateResource, useResource } from "@/lib/client/resource";
import { formatDate } from "@/lib/utils";
import { confirmAction } from "@/components/common/confirm";
import { EmptyState, IconButton, MetaLabel, SwatchStrip } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { makeEntry, useExplore } from "./store";

export const SAVED_KEY = "/api/scenes?status=concept";

export function SavedConcepts() {
  const { data, loading, error, reload } = useResource<{ scenes: Scene[] }>(SAVED_KEY);
  const setCurrent = useExplore((s) => s.setCurrent);
  const forgetSaved = useExplore((s) => s.forgetSaved);
  const scenes = data?.scenes ?? [];

  async function remove(scene: Scene) {
    const ok = await confirmAction({
      title: `Remove "${scene.title}"?`,
      description: "The concept is archived and leaves this list. Images already generated from it keep their own record.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api(`/api/scenes/${scene.id}`, { method: "DELETE" });
      mutateResource<{ scenes: Scene[] }>(SAVED_KEY, (cur) => (cur ? { scenes: cur.scenes.filter((s) => s.id !== scene.id) } : cur));
      forgetSaved(scene.id);
      invalidate("/api/scenes");
      toast.success("Concept removed");
    } catch (err) {
      toast.error("Could not remove the concept", { description: errorMessage(err) });
    }
  }

  function load(scene: Scene) {
    const concept = sceneToConcept(scene);
    if (!concept) {
      toast.error("This concept cannot be loaded into Explore", { description: "Open it in the Studio instead." });
      return;
    }
    setCurrent(makeEntry(concept, { kind: "saved", sceneId: scene.id }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <MetaLabel>Saved concepts</MetaLabel>
        {scenes.length ? <span className="font-mono text-[11px] text-text-muted tabular-nums">{scenes.length}</span> : null}
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[92px] w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md border border-border px-3 py-4 text-[12px] text-text-muted">
          Saved concepts could not be loaded.{" "}
          <button type="button" className="text-text-secondary underline underline-offset-2" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      ) : !scenes.length ? (
        <EmptyState
          icon={Bookmark}
          title="No saved concepts"
          description="Save a concept to keep it here. Saved concepts open in the Studio as scenes, ready to direct."
          className="rounded-md border border-dashed border-border py-10"
        />
      ) : (
        <ul className="space-y-2">
          {scenes.map((scene) => (
            <li key={scene.id} className="group rounded-md border border-border bg-surface">
              <button
                type="button"
                onClick={() => load(scene)}
                className="block w-full rounded-t-md px-3 pt-3 text-left focus-visible:outline-1 focus-visible:outline-text-secondary"
                aria-label={`Explore from ${scene.title}`}
              >
                <div className="truncate text-[12.5px] text-foreground">{scene.title}</div>
                {scene.description ? <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-text-muted">{scene.description}</p> : null}
                <SwatchStrip hexes={scene.palette.swatches.map((s) => s.hex)} size="sm" className="mt-2.5 h-1.5" />
              </button>
              <div className="flex items-center justify-between px-1.5 py-1.5 pl-3">
                <span className="text-[11px] text-text-muted">{formatDate(scene.createdAt, { month: "short", day: "numeric" })}</span>
                <div className="flex items-center">
                  <Button asChild variant="ghost" size="xs" className="text-text-secondary hover:text-foreground">
                    <Link href={`/studio?scene=${scene.id}`}>
                      Open in Studio <ArrowUpRight />
                    </Link>
                  </Button>
                  <IconButton icon={Trash2} label="Remove concept" size="icon-xs" onClick={() => void remove(scene)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
