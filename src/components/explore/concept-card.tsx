"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Concept, ConceptVariable } from "@/lib/domain/schemas";
import { CHARACTER_OPTIONS, COMPOSITION_PRESET_OPTIONS, TIME_OPTIONS } from "@/lib/domain/vocab";
import { cn, titleCase } from "@/lib/utils";
import { LockToggle, MetaLabel, SwatchStrip } from "@/components/common/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConceptSource } from "./store";

export const VARIABLE_LABELS: Record<ConceptVariable, string> = {
  character: "Character",
  action: "Action",
  environment: "Environment",
  naturalElement: "Natural element",
  material: "Material",
  scale: "Scale",
  phenomenon: "Impossible phenomenon",
  composition: "Composition",
  emotionalTone: "Emotional tone",
  lighting: "Lighting",
  palette: "Palette",
  atmosphere: "Atmosphere",
};

const ORDER: ConceptVariable[] = [
  "character",
  "action",
  "environment",
  "phenomenon",
  "naturalElement",
  "material",
  "scale",
  "composition",
  "lighting",
  "emotionalTone",
  "atmosphere",
  "palette",
];

export const characterLabel = (c: Pick<Concept, "character" | "characterLabel">) => {
  const base = CHARACTER_OPTIONS.find((o) => o.key === c.character)?.label ?? titleCase(c.character);
  return c.characterLabel ? `${base}: ${c.characterLabel}` : base;
};
export const compositionLabel = (k: Concept["composition"]) => COMPOSITION_PRESET_OPTIONS.find((o) => o.key === k)?.label ?? titleCase(k);
const timeLabel = (k: Concept["timeOfDay"]) => TIME_OPTIONS.find((o) => o.key === k)?.label ?? titleCase(k);

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function formatHeight(h: number) {
  return h < 1 ? h.toFixed(1) : h < 10 ? h.toFixed(1).replace(/\.0$/, "") : Math.round(h).toString();
}

function variableValue(c: Concept, v: ConceptVariable): { value: React.ReactNode; sub?: React.ReactNode } {
  switch (v) {
    case "character":
      return { value: characterLabel(c) };
    case "action":
      return { value: c.action ? cap(c.action) : "No action" };
    case "environment":
      return { value: cap(c.environment) };
    case "naturalElement":
      return { value: titleCase(c.naturalElement) };
    case "material":
      return { value: cap(c.material) };
    case "scale":
      return { value: cap(c.scale), sub: `Subject about ${formatHeight(c.subjectHeight)}% of frame height` };
    case "phenomenon":
      return { value: cap(c.phenomenon) };
    case "composition":
      return { value: compositionLabel(c.composition), sub: `Anchored ${titleCase(c.anchor).toLowerCase()}` };
    case "emotionalTone":
      return { value: cap(c.emotionalTone) };
    case "lighting":
      return { value: cap(c.lighting), sub: `Time of day: ${timeLabel(c.timeOfDay)}` };
    case "atmosphere":
      return { value: cap(c.atmosphere) };
    case "palette":
      return {
        value: <SwatchStrip hexes={c.palette} className="mt-0.5 h-5" />,
        sub: (
          <span className="flex items-center justify-between gap-2">
            <span className="truncate">{c.paletteName}</span>
            <span className="shrink-0 font-mono text-[10.5px]">{c.palette.length} colours</span>
          </span>
        ),
      };
  }
}

export function sourceLabel(source: ConceptSource) {
  if (source.kind === "ai") return `AI${source.model ? `, ${source.model}` : ""}`;
  if (source.kind === "saved") return "Saved concept";
  return "Built-in engine";
}

export function ConceptCard({
  concept,
  source,
  entryKey,
  locked,
  onToggleLock,
  busy,
  footer,
}: {
  concept: Concept;
  source: ConceptSource;
  entryKey: string;
  locked: Partial<Record<ConceptVariable, true>>;
  onToggleLock: (v: ConceptVariable) => void;
  busy?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <article
      aria-busy={busy}
      aria-label={`Current concept: ${concept.title}`}
      className={cn("overflow-hidden rounded-lg border border-border bg-surface transition-opacity", busy && "opacity-60")}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={entryKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <header className="px-7 pt-6 pb-6">
            <div className="mb-4 flex items-center gap-2">
              <MetaLabel>Current concept</MetaLabel>
              <span className="text-text-muted/50" aria-hidden>
                /
              </span>
              <span className="text-[11.5px] text-text-muted">{sourceLabel(source)}</span>
            </div>
            <h2 className="text-editorial text-[30px] leading-[38px] text-foreground">{concept.title}</h2>
            <p className="mt-2.5 max-w-3xl text-[15px] leading-relaxed text-text-secondary">{concept.logline}</p>
          </header>
          <dl className="grid grid-cols-1 gap-px border-t border-border bg-border md:grid-cols-2 xl:grid-cols-3">
            {ORDER.map((v) => {
              const { value, sub } = variableValue(concept, v);
              const isLocked = !!locked[v];
              return (
                <div key={v} className={cn("min-h-[96px] px-5 py-4", isLocked ? "bg-elevated" : "bg-surface")}>
                  <div className="flex h-5 items-center justify-between gap-2">
                    <dt className="label-meta">{VARIABLE_LABELS[v]}</dt>
                    <LockToggle locked={isLocked} onToggle={() => onToggleLock(v)} label={VARIABLE_LABELS[v]} />
                  </div>
                  <dd className="mt-1.5 text-[13px] leading-snug text-foreground">{value}</dd>
                  {sub ? <dd className="mt-1.5 text-[11.5px] text-text-muted">{sub}</dd> : null}
                </div>
              );
            })}
          </dl>
        </motion.div>
      </AnimatePresence>
      {footer ? <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">{footer}</footer> : null}
    </article>
  );
}

export function ConceptCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface" aria-busy="true" aria-label="Generating the first concept">
      <div className="space-y-3 px-7 pt-6 pb-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-2/3 max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-px border-t border-border bg-border md:grid-cols-2 xl:grid-cols-3">
        {ORDER.map((v) => (
          <div key={v} className="min-h-[96px] space-y-2 bg-surface px-5 py-4">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Compact concept tile used for batch picks and session history. */
export function ConceptTile({
  concept,
  active,
  onSelect,
  compact,
  index,
}: {
  concept: Concept;
  active?: boolean;
  onSelect: () => void;
  compact?: boolean;
  index?: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group flex w-full flex-col rounded-md border bg-surface text-left transition-colors hover:bg-elevated focus-visible:outline-1 focus-visible:outline-text-secondary",
        active ? "border-text-muted" : "border-border",
        compact ? "gap-2 p-2.5" : "gap-3 p-4",
      )}
    >
      <SwatchStrip hexes={concept.palette} size="sm" className={compact ? "h-1.5" : "h-2"} />
      <div className="min-w-0">
        {index != null ? <div className="label-meta mb-1">Concept {index + 1}</div> : null}
        <div className={cn("truncate text-foreground", compact ? "text-[12px]" : "text-[13.5px]")}>{concept.title}</div>
        {!compact ? (
          <>
            <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-text-secondary">{concept.logline}</p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
              <span>{characterLabel(concept)}</span>
              <span>{compositionLabel(concept.composition)}</span>
              <span>{concept.emotionalTone}</span>
            </div>
          </>
        ) : (
          <div className="truncate text-[11px] text-text-muted">{characterLabel(concept)}</div>
        )}
      </div>
    </button>
  );
}
