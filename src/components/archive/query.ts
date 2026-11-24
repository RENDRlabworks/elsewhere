"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const PAGE_SIZE = 60;

export const REVIEW_FILTERS = [
  { key: "all", label: "All" },
  { key: "favorites", label: "Favorites" },
  { key: "unreviewed", label: "Unreviewed" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number]["key"];

export const STATUS_FILTERS = [
  { key: "any", label: "Any status" },
  { key: "completed", label: "Completed" },
  { key: "active", label: "In progress" },
  { key: "failed", label: "Failed" },
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

/** Archive filters as they live in the URL. */
export type ArchiveQuery = {
  q: string;
  filter: ReviewFilter;
  status: StatusFilter;
  character: string;
  environment: string;
  model: string;
  style: string;
  color: string;
  from: string;
  to: string;
};

const KEYS: (keyof ArchiveQuery)[] = ["q", "filter", "status", "character", "environment", "model", "style", "color", "from", "to"];
const DEFAULTS: ArchiveQuery = { q: "", filter: "all", status: "any", character: "", environment: "", model: "", style: "", color: "", from: "", to: "" };

const oneOf = <T extends string>(v: string | null, list: readonly { key: T }[], fallback: T): T =>
  list.some((x) => x.key === v) ? (v as T) : fallback;

export function useArchiveQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query: ArchiveQuery = React.useMemo(
    () => ({
      q: params.get("q") ?? "",
      filter: oneOf(params.get("filter"), REVIEW_FILTERS, "all"),
      status: oneOf(params.get("status"), STATUS_FILTERS, "any"),
      character: params.get("character") ?? "",
      environment: params.get("environment") ?? "",
      model: params.get("model") ?? "",
      style: params.get("style") ?? "",
      color: params.get("color") ?? "",
      from: params.get("from") ?? "",
      to: params.get("to") ?? "",
    }),
    [params],
  );

  const update = React.useCallback(
    (patch: Partial<ArchiveQuery>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch) as [keyof ArchiveQuery, string][]) {
        if (!v || v === DEFAULTS[k]) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, router, pathname],
  );

  const clear = React.useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  const activeCount = KEYS.filter((k) => k !== "q" && query[k] !== DEFAULTS[k]).length;
  const hasAny = activeCount > 0 || !!query.q.trim();

  return { query, update, clear, activeCount, hasAny };
}

/** The API key (without paging) for a set of archive filters. */
export function apiBase(q: ArchiveQuery) {
  const p = new URLSearchParams();
  if (q.q.trim()) p.set("q", q.q.trim());
  if (q.filter !== "all") p.set("filter", q.filter);
  if (q.status !== "any") p.set("status", q.status);
  if (q.character) p.set("character", q.character);
  if (q.environment) p.set("environment", q.environment);
  if (q.model) p.set("model", q.model);
  if (q.style) p.set("styleProfileId", q.style);
  if (q.color) p.set("paletteHex", q.color);
  if (q.from) {
    const d = new Date(`${q.from}T00:00:00`);
    if (!Number.isNaN(d.getTime())) p.set("from", d.toISOString());
  }
  if (q.to) {
    const d = new Date(`${q.to}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) p.set("to", d.toISOString());
  }
  p.set("limit", String(PAGE_SIZE));
  return `/api/generations?${p.toString()}`;
}

export const pageKey = (base: string, page: number) => `${base}&offset=${page * PAGE_SIZE}`;
