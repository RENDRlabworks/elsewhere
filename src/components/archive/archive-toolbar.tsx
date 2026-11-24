"use client";

import * as React from "react";
import { CalendarRange, Search, X } from "lucide-react";
import { CHARACTER_OPTIONS } from "@/lib/domain/vocab";
import { useResource } from "@/lib/client/resource";
import { useProfiles } from "@/stores/app";
import { cn, formatDate, titleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetaLabel } from "@/components/common/primitives";
import { type ArchiveQuery, REVIEW_FILTERS, STATUS_FILTERS } from "./query";

type Facet = { value: string; count: number };
export type Facets = { characters: Facet[]; environments: Facet[]; models: Facet[]; styles: Facet[]; palette: Facet[] };

const ALL = "__all";

export function ArchiveFilters({
  query,
  update,
  clear,
  hasAny,
}: {
  query: ArchiveQuery;
  update: (p: Partial<ArchiveQuery>) => void;
  clear: () => void;
  hasAny: boolean;
}) {
  const { data: facets } = useResource<Facets>("/api/generations/facets");
  const profiles = useProfiles();
  const styleName = (id: string) => profiles.find((p) => p.id === id)?.name ?? "Unknown style";
  const charName = (k: string) => CHARACTER_OPTIONS.find((o) => o.key === k)?.label ?? titleCase(k);

  return (
    <div className="flex w-max items-center gap-2 md:w-auto md:flex-wrap">
      <div className="flex shrink-0 rounded-md border border-border p-0.5" role="group" aria-label="Review filter">
        {REVIEW_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={query.filter === f.key}
            onClick={() => update({ filter: f.key })}
            className={cn(
              "h-6 rounded-sm px-2.5 text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-text-secondary",
              query.filter === f.key ? "bg-interactive text-foreground" : "text-text-muted hover:text-text-secondary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <FacetSelect
        label="Status"
        value={query.status === "any" ? "" : query.status}
        allLabel="Any status"
        options={STATUS_FILTERS.filter((s) => s.key !== "any").map((s) => ({ value: s.key, label: s.label }))}
        onChange={(v) => update({ status: (v || "any") as ArchiveQuery["status"] })}
      />
      <FacetSelect
        label="Subject"
        value={query.character}
        allLabel="All subjects"
        options={(facets?.characters ?? []).map((f) => ({ value: f.value, label: charName(f.value), count: f.count }))}
        onChange={(v) => update({ character: v })}
      />
      <FacetSelect
        label="Environment"
        value={query.environment}
        allLabel="All environments"
        options={(facets?.environments ?? []).map((f) => ({ value: f.value, label: f.value, count: f.count }))}
        onChange={(v) => update({ environment: v })}
        wide
      />
      <FacetSelect
        label="Model"
        value={query.model}
        allLabel="All models"
        options={(facets?.models ?? []).map((f) => ({ value: f.value, label: f.value, count: f.count }))}
        onChange={(v) => update({ model: v })}
        mono
      />
      <FacetSelect
        label="Look"
        value={query.style}
        allLabel="All styles"
        options={(facets?.styles ?? []).map((f) => ({ value: f.value, label: styleName(f.value), count: f.count }))}
        onChange={(v) => update({ style: v })}
      />
      <PaletteFilter value={query.color} palette={facets?.palette ?? []} onChange={(color) => update({ color })} />
      <DateFilter from={query.from} to={query.to} onChange={(from, to) => update({ from, to })} />

      {hasAny ? (
        <Button size="sm" variant="ghost" onClick={clear} className="text-text-muted hover:text-foreground">
          <X /> Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function FacetSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
  wide,
  mono,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: { value: string; label: string; count?: number }[];
  onChange: (v: string) => void;
  wide?: boolean;
  mono?: boolean;
}) {
  const known = !value || options.some((o) => o.value === value);
  const shown = value ? (options.find((o) => o.value === value)?.label ?? value) : allLabel;
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        className={cn(
          "h-7 border-border bg-transparent text-[12px] dark:bg-transparent",
          wide ? "max-w-52" : "max-w-40",
          value ? "border-text-muted/60 text-foreground" : "text-text-secondary",
        )}
      >
        <SelectValue placeholder={label}>
          <span className={cn("truncate", mono && value && "font-mono text-[11.5px]")}>{shown}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-h-80 min-w-48">
        <SelectItem value={ALL} className="text-[12.5px]">
          {allLabel}
        </SelectItem>
        {!known ? (
          <SelectItem value={value} className="text-[12.5px]">
            {value}
          </SelectItem>
        ) : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[12.5px] *:[span]:last:w-full">
            <span className={cn("max-w-64 min-w-0 flex-1 truncate", mono && "font-mono text-[11.5px]")}>{o.label}</span>
            {o.count != null ? <span className="ml-auto pl-3 font-mono text-[11px] text-text-muted tabular-nums">{o.count}</span> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PaletteFilter({ value, palette, onChange }: { value: string; palette: Facet[]; onChange: (v: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          aria-label={value ? `Palette colour ${value}` : "Palette colour"}
          className={cn("h-7 border border-border text-[12px] font-normal", value ? "border-text-muted/60 text-foreground" : "text-text-secondary")}
        >
          {value ? <span className="size-3 rounded-sm border border-white/10" style={{ background: value }} /> : null}
          {value ? <span className="font-mono text-[11.5px]">{value}</span> : "Palette"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <MetaLabel>Contains colour</MetaLabel>
        {palette.length ? (
          <div className="grid grid-cols-8 gap-1.5" role="group" aria-label="Palette colours">
            {palette.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={value === p.value}
                aria-label={`${p.value}, ${p.count} image${p.count === 1 ? "" : "s"}`}
                title={`${p.value} (${p.count})`}
                onClick={() => {
                  onChange(value === p.value ? "" : p.value);
                  setOpen(false);
                }}
                className={cn(
                  "aspect-square rounded-sm border outline-none ring-offset-2 ring-offset-popover focus-visible:ring-1 focus-visible:ring-text-secondary",
                  value === p.value ? "border-foreground ring-1 ring-foreground" : "border-white/10",
                )}
                style={{ background: p.value }}
              />
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-text-muted">No palette data yet.</div>
        )}
        {value ? (
          <Button size="xs" variant="ghost" className="self-end" onClick={() => onChange("")}>
            Any colour
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function DateFilter({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const active = from || to;
  const label = from && to ? `${short(from)} to ${short(to)}` : from ? `From ${short(from)}` : to ? `Until ${short(to)}` : "Date";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className={cn("h-7 border border-border text-[12px] font-normal", active ? "border-text-muted/60 text-foreground" : "text-text-secondary")}
        >
          <CalendarRange className="text-text-muted" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-3 p-3">
        <MetaLabel>Created</MetaLabel>
        <div className="grid grid-cols-[40px_1fr] items-center gap-2">
          <label htmlFor="archive-from" className="text-[12px] text-text-muted">
            From
          </label>
          <Input id="archive-from" type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className="h-7 font-mono text-[11.5px]" />
          <label htmlFor="archive-to" className="text-[12px] text-text-muted">
            To
          </label>
          <Input id="archive-to" type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className="h-7 font-mono text-[11.5px]" />
        </div>
        {active ? (
          <Button size="xs" variant="ghost" className="self-end" onClick={() => onChange("", "")}>
            Any date
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

const short = (d: string) => formatDate(`${d}T12:00:00`, { month: "short", day: "numeric" });

export function SearchField({
  value,
  onChange,
  inputRef,
  placeholder = "Search titles, prompts, places",
  label = "Search the Library",
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div className="relative w-full md:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-muted" />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (value) onChange("");
            else e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 pr-8 pl-8 text-[16px] md:h-8 md:text-[12.5px] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-text-muted hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      ) : (
        <Kbd className="absolute top-1/2 right-2 hidden -translate-y-1/2 md:inline-flex">/</Kbd>
      )}
    </div>
  );
}
