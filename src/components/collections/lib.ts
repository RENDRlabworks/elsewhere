"use client";

import type { Collection, Generation, Scene } from "@/lib/domain/schemas";
import type { CollectionItemView } from "@/lib/services/collections";
import type { ReviewStatus } from "@/lib/domain/vocab";
import { hueFamily, isHex } from "@/lib/palette/color";
import { effectiveSwatches } from "@/lib/palette/engine";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate } from "@/lib/client/resource";
import { toast } from "sonner";

export type CollectionDetailData = { collection: Collection; items: CollectionItemView[] };

export const detailKey = (id: string) => `/api/collections/${id}`;

/** Every cache that can show a collection or its images. */
export function refreshCollections() {
  invalidate("/api/collections", "/api/generations", "/api/insights");
}

export async function patchCollection(id: string, patch: Partial<Pick<Collection, "name" | "description" | "notes" | "tags" | "targetCount" | "viewMode" | "styleProfileId" | "coverGenerationId">>) {
  try {
    const res = await api<{ collection: Collection }>(`/api/collections/${id}`, { method: "PATCH", body: patch });
    invalidate("/api/collections");
    return res.collection;
  } catch (err) {
    toast.error(errorMessage(err));
    return null;
  }
}

export function aspectOf(ratio: string | null | undefined) {
  const [w, h] = (ratio ?? "4:5").split(":").map(Number);
  return w && h ? `${w} / ${h}` : "4 / 5";
}

export function sceneHexes(scene: Scene | null): string[] {
  if (!scene) return [];
  try {
    return effectiveSwatches(scene.palette).slice(0, 5);
  } catch {
    return scene.palette.swatches.map((s) => s.hex).slice(0, 5);
  }
}

export function seriesNumber(item: CollectionItemView, index: number) {
  const n = item.scene?.seriesIndex ?? index + 1;
  return String(n).padStart(2, "0");
}

export function familiesOf(g: Pick<Generation, "paletteHexes">): string[] {
  const out = new Set<string>();
  for (const h of g.paletteHexes ?? []) {
    if (isHex(h)) out.add(hueFamily(h));
  }
  return [...out];
}

/** Representative swatches for hue families. Content colour only, never UI chrome. */
export const FAMILY_SWATCH: Record<string, string> = {
  red: "#a8463b",
  orange: "#c27a3a",
  yellow: "#c9a94a",
  green: "#5d8358",
  teal: "#4a8783",
  blue: "#47669a",
  violet: "#755a9a",
  rose: "#a65a7a",
  neutral: "#7a7a7f",
  black: "#141416",
  white: "#e9e7e2",
};

export const FAMILY_ORDER = Object.keys(FAMILY_SWATCH);

export type ItemFilters = {
  minRating: number;
  review: "all" | ReviewStatus;
  character: string | null;
  family: string | null;
  from: string;
  to: string;
};

export const EMPTY_FILTERS: ItemFilters = { minRating: 0, review: "all", character: null, family: null, from: "", to: "" };

export function activeFilterCount(f: ItemFilters) {
  return [f.minRating > 0, f.review !== "all", !!f.character, !!f.family, !!f.from, !!f.to].filter(Boolean).length;
}

export function matchesFilters(g: Generation, f: ItemFilters) {
  if (f.minRating && g.rating < f.minRating) return false;
  if (f.review !== "all" && g.reviewStatus !== f.review) return false;
  if (f.character && g.characterKind !== f.character) return false;
  if (f.family && !familiesOf(g).includes(f.family)) return false;
  const day = g.createdAt.slice(0, 10);
  if (f.from && day < f.from) return false;
  if (f.to && day > f.to) return false;
  return true;
}

export function relativeDay(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Whether a collection matches a Library search: every word must appear in its name, description, notes or tags. */
export function matchesCollection(c: Pick<Collection, "name" | "description" | "notes" | "tags">, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [c.name, c.description, c.notes, ...c.tags].join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}
