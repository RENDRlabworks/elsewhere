"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, assetSrc, errorMessage } from "@/lib/client/api";
import { invalidate, useResource } from "@/lib/client/resource";
import type { CollectionSummary } from "@/lib/services/collections";
import { useCollectionPicker } from "./actions";

/** Global dialog for adding one or more images to a collection (or a new one). */
export function CollectionPicker() {
  const { open, ids, close } = useCollectionPicker();
  const { data } = useResource<{ collections: CollectionSummary[] }>(open ? "/api/collections" : null);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function addTo(collectionId: string, label: string) {
    setBusy(collectionId);
    try {
      const res = await api<{ added: number; skipped: number }>(`/api/collections/${collectionId}/items`, {
        method: "POST",
        body: { generationIds: ids },
      });
      invalidate("/api/collections", "/api/generations");
      toast.success(
        res.added ? `Added ${res.added} image${res.added > 1 ? "s" : ""} to ${label}` : `Already in ${label}`,
      );
      close();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy("new");
    try {
      const { collection } = await api<{ collection: { id: string; name: string } }>("/api/collections", {
        method: "POST",
        body: { name: name.trim() },
      });
      setName("");
      await addTo(collection.id, collection.name);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-medium">Add to collection</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            {ids.length} image{ids.length === 1 ? "" : "s"} selected
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 max-h-72 space-y-0.5 overflow-y-auto">
          {(data?.collections ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={!!busy}
              onClick={() => addTo(c.id, c.name)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-interactive disabled:opacity-60"
            >
              <div className="size-8 shrink-0 overflow-hidden rounded-sm bg-elevated">
                {c.coverAssetId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetSrc(c.coverAssetId)!} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px]">{c.name}</div>
                <div className="text-[11.5px] text-text-muted">{c.imageCount} images</div>
              </div>
              {busy === c.id ? <Check className="size-3.5 animate-pulse" /> : null}
            </button>
          ))}
          {!data ? <div className="px-2 py-4 text-[12px] text-text-muted">Loading collections…</div> : null}
        </div>
        <form onSubmit={createAndAdd} className="flex gap-2 border-t border-border pt-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection name" aria-label="New collection name" />
          <Button type="submit" variant="secondary" disabled={!name.trim() || !!busy}>
            <Plus /> Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
