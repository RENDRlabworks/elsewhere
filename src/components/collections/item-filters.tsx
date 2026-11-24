"use client";

import * as React from "react";
import { ListFilter, Star } from "lucide-react";
import type { Generation } from "@/lib/domain/schemas";
import { CHARACTER_OPTIONS } from "@/lib/domain/vocab";
import { cn, titleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MetaLabel } from "@/components/common/primitives";
import { activeFilterCount, EMPTY_FILTERS, FAMILY_ORDER, FAMILY_SWATCH, familiesOf, type ItemFilters } from "./lib";

const REVIEW: { key: ItemFilters["review"]; label: string }[] = [
  { key: "all", label: "Any" },
  { key: "accepted", label: "Accepted" },
  { key: "unreviewed", label: "Unreviewed" },
  { key: "rejected", label: "Rejected" },
];

export function ItemFiltersButton({
  value,
  onChange,
  generations,
}: {
  value: ItemFilters;
  onChange: (f: ItemFilters) => void;
  generations: Generation[];
}) {
  const count = activeFilterCount(value);
  const set = (patch: Partial<ItemFilters>) => onChange({ ...value, ...patch });

  const characters = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const g of generations) if (g.characterKind) m.set(g.characterKind, (m.get(g.characterKind) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [generations]);

  const families = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const g of generations) for (const f of familiesOf(g)) m.set(f, (m.get(f) ?? 0) + 1);
    return FAMILY_ORDER.filter((f) => m.has(f)).map((f) => [f, m.get(f)!] as const);
  }, [generations]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("text-text-secondary", count && "bg-interactive text-foreground")} aria-label={count ? `Filters, ${count} active` : "Filters"}>
          <ListFilter /> Filter
          {count ? <span className="font-mono text-[11px] text-text-muted tabular-nums">{count}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-4 p-4">
        <div className="space-y-2">
          <MetaLabel>Minimum rating</MetaLabel>
          <div className="flex items-center gap-0.5" role="group" aria-label="Minimum rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={value.minRating === n}
                aria-label={`${n} star${n > 1 ? "s" : ""} or more`}
                onClick={() => set({ minRating: value.minRating === n ? 0 : n })}
                className="flex size-7 items-center justify-center rounded-sm text-text-muted outline-none hover:bg-interactive hover:text-foreground focus-visible:ring-1 focus-visible:ring-text-secondary"
              >
                <Star className={cn("size-3.5", n <= value.minRating && "fill-foreground text-foreground")} strokeWidth={1.5} />
              </button>
            ))}
            <span className="ml-2 text-[11.5px] text-text-muted">{value.minRating ? `${value.minRating}+ stars` : "Any rating"}</span>
          </div>
        </div>

        <div className="space-y-2">
          <MetaLabel>Review status</MetaLabel>
          <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Review status">
            {REVIEW.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={value.review === r.key}
                onClick={() => set({ review: r.key })}
                className={cn(
                  "h-6 flex-1 rounded-sm text-[11.5px] outline-none focus-visible:ring-1 focus-visible:ring-text-secondary",
                  value.review === r.key ? "bg-interactive text-foreground" : "text-text-muted hover:text-text-secondary",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <MetaLabel>Subject</MetaLabel>
          {characters.length ? (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Subject">
              {characters.map(([k, n]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={value.character === k}
                  onClick={() => set({ character: value.character === k ? null : k })}
                  className={cn(
                    "h-6 rounded-sm border px-2 text-[11.5px] outline-none focus-visible:ring-1 focus-visible:ring-text-secondary",
                    value.character === k ? "border-text-muted bg-interactive text-foreground" : "border-border text-text-secondary hover:text-foreground",
                  )}
                >
                  {CHARACTER_OPTIONS.find((o) => o.key === k)?.label ?? titleCase(k)} <span className="text-text-muted">{n}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[11.5px] text-text-muted">No subjects recorded yet.</div>
          )}
        </div>

        <div className="space-y-2">
          <MetaLabel>Palette</MetaLabel>
          {families.length ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Palette colour family">
              {families.map(([f, n]) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={value.family === f}
                  aria-label={`${titleCase(f)}, ${n} image${n > 1 ? "s" : ""}`}
                  title={`${titleCase(f)} (${n})`}
                  onClick={() => set({ family: value.family === f ? null : f })}
                  className={cn(
                    "size-6 rounded-sm border outline-none ring-offset-2 ring-offset-popover focus-visible:ring-1 focus-visible:ring-text-secondary",
                    value.family === f ? "border-foreground ring-1 ring-foreground" : "border-white/10",
                  )}
                  style={{ background: FAMILY_SWATCH[f] }}
                />
              ))}
            </div>
          ) : (
            <div className="text-[11.5px] text-text-muted">No palette data yet.</div>
          )}
        </div>

        <div className="space-y-2">
          <MetaLabel>Generated</MetaLabel>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" aria-label="From date" value={value.from} max={value.to || undefined} onChange={(e) => set({ from: e.target.value })} className="h-7 font-mono text-[11.5px]" />
            <Input type="date" aria-label="To date" value={value.to} min={value.from || undefined} onChange={(e) => set({ to: e.target.value })} className="h-7 font-mono text-[11.5px]" />
          </div>
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <Button size="xs" variant="ghost" disabled={!count} onClick={() => onChange(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
