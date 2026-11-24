"use client";

import { toast } from "sonner";
import { create } from "zustand";
import type { Generation } from "@/lib/domain/schemas";
import { api, assetDownload, downloadPost, errorMessage } from "@/lib/client/api";
import { invalidate } from "@/lib/client/resource";
import { confirmAction } from "@/components/common/confirm";

/** Shared mutations for images. Every path invalidates the caches that show images. */

export const GENERATION_KEYS = ["/api/generations", "/api/collections", "/api/insights"];

export async function patchGeneration(id: string, patch: Partial<Pick<Generation, "title" | "notes" | "rating" | "favorite" | "reviewStatus" | "tags">>) {
  const res = await api<{ generation: Generation }>(`/api/generations/${id}`, { method: "PATCH", body: patch });
  invalidate(...GENERATION_KEYS);
  return res.generation;
}

export async function toggleFavorite(g: Generation) {
  try {
    const next = await patchGeneration(g.id, { favorite: !g.favorite });
    toast.success(next.favorite ? "Added to favorites" : "Removed from favorites");
    return next;
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

export async function setReviewStatus(g: Generation, reviewStatus: Generation["reviewStatus"]) {
  try {
    const prev = g.reviewStatus;
    const next = await patchGeneration(g.id, { reviewStatus });
    toast(reviewStatus === "rejected" ? "Image rejected. It stays in the archive." : reviewStatus === "accepted" ? "Image accepted" : "Marked unreviewed", {
      action: { label: "Undo", onClick: () => void patchGeneration(g.id, { reviewStatus: prev }) },
    });
    return next;
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

export async function deletePermanently(g: Pick<Generation, "id" | "title">): Promise<boolean> {
  const ok = await confirmAction({
    title: "Delete this image permanently?",
    description: `"${g.title}" and its file will be removed from storage, collections and history. This cannot be undone. To keep it but hide it, reject it instead.`,
    confirmLabel: "Delete permanently",
    destructive: true,
  });
  if (!ok) return false;
  try {
    await api(`/api/generations/${g.id}`, { method: "DELETE" });
    invalidate(...GENERATION_KEYS);
    toast.success("Image deleted");
    return true;
  } catch (err) {
    toast.error(errorMessage(err));
    return false;
  }
}

export function downloadGeneration(g: Generation) {
  if (!g.assetId) return;
  const ext = g.outputSettings?.format === "jpeg" ? "jpg" : (g.outputSettings?.format ?? "png");
  const name = `${g.title.replace(/[^\w-]+/g, "-").toLowerCase() || "elsewhere"}.${g.source === "imported" ? "" : ext}`.replace(/\.$/, "");
  const a = Object.assign(document.createElement("a"), { href: assetDownload(g.assetId, name) });
  a.click();
}

export async function downloadMany(ids: string[]) {
  if (!ids.length) return;
  const t = toast.loading(`Preparing ${ids.length} image${ids.length > 1 ? "s" : ""}`);
  try {
    await downloadPost("/api/generations/download", { ids }, `elsewhere-${new Date().toISOString().slice(0, 10)}.zip`);
    toast.success("Download ready", { id: t });
  } catch (err) {
    toast.error(errorMessage(err), { id: t });
  }
}

/** Global "add to collection" dialog state. */
export const useCollectionPicker = create<{ ids: string[]; open: boolean; show: (ids: string[]) => void; close: () => void }>((set) => ({
  ids: [],
  open: false,
  show: (ids) => set({ ids, open: true }),
  close: () => set({ open: false }),
}));

export const STATUS_LABEL: Record<Generation["status"], string> = {
  queued: "Queued",
  generating: "Generating",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const isActive = (s: Generation["status"]) => s === "queued" || s === "generating" || s === "processing";
