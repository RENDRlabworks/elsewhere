"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import type { CollectionInsights, Distribution } from "@/lib/composition/analytics";
import { useResource } from "@/lib/client/resource";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconButton, MetaLabel } from "@/components/common/primitives";

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function InsightsPanel({ collectionId, onClose }: { collectionId: string; onClose: () => void }) {
  const { data, error, loading, reload } = useResource<{ insights: CollectionInsights }>(`/api/collections/${collectionId}/insights`);
  const ins = data?.insights;

  return (
    <aside aria-label="Collection insights" className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border pr-3 pl-5">
        <div className="text-[13px] font-medium">Insights</div>
        <IconButton icon={X} label="Close insights" onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="aspect-[4/5] w-2/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error && !ins ? (
          <div className="space-y-3 py-8 text-center">
            <div className="text-[12.5px] text-text-muted">{error.message}</div>
            <Button size="sm" variant="secondary" onClick={() => void reload()}>
              Try again
            </Button>
          </div>
        ) : ins ? (
          <InsightsBody ins={ins} />
        ) : null}
      </div>
    </aside>
  );
}

function InsightsBody({ ins }: { ins: CollectionInsights }) {
  if (!ins.total) {
    return (
      <div className="py-10 text-center">
        <div className="text-[13px] text-foreground">Nothing to analyse yet</div>
        <p className="mx-auto mt-1 max-w-60 text-[12px] text-text-muted">
          Insights read the scene settings of completed images. Add or import images to see how the series is composed.
        </p>
      </div>
    );
  }
  const max = Math.max(1, ...ins.heatmap.flat());
  const acc = ins.acceptance;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
        <Cell label="Images" value={String(ins.total)} hint={ins.analysed < ins.total ? `${ins.analysed} with scene data` : "All with scene data"} />
        <Cell
          label="Acceptance"
          value={acc.rate === null ? "n/a" : pct(acc.rate)}
          hint={`${acc.accepted} accepted · ${acc.rejected} rejected · ${acc.unreviewed} open`}
        />
      </div>

      <Block title="Diversity">
        <div className="space-y-2">
          {(
            [
              ["Character", ins.diversity.character],
              ["Environment", ins.diversity.environment],
              ["Composition", ins.diversity.composition],
              ["Placement", ins.diversity.placement],
              ["Palette", ins.diversity.palette],
            ] as const
          ).map(([label, v]) => (
            <Bar key={label} label={label} share={v} value={pct(v)} />
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-text-muted">100% means evenly spread; low values mean the series keeps returning to the same choice.</p>
      </Block>

      {ins.analysed ? (
        <Block title="Subject placement">
          <div className="flex items-start gap-4">
            <div
              className="grid aspect-[4/5] w-40 shrink-0 grid-cols-5 grid-rows-5 gap-px overflow-hidden rounded-sm border border-border bg-border"
              role="img"
              aria-label="Heatmap of where subjects sit in the frame"
            >
              {ins.heatmap.flatMap((row, r) =>
                row.map((v, c) => (
                  <div key={`${r}-${c}`} className="relative bg-background" title={`${v} image${v === 1 ? "" : "s"}`}>
                    <div className="absolute inset-0 bg-foreground" style={{ opacity: v ? 0.12 + (v / max) * 0.7 : 0 }} />
                  </div>
                )),
              )}
            </div>
            <div className="min-w-0 space-y-1.5 pt-0.5">
              {ins.anchors.slice(0, 5).map((a) => (
                <div key={a.key} className="flex items-baseline justify-between gap-3 text-[12px]">
                  <span className="truncate text-text-secondary">{a.label}</span>
                  <span className="font-mono text-[11px] text-text-muted tabular-nums">{a.count}</span>
                </div>
              ))}
              {!ins.anchors.length ? <div className="text-[12px] text-text-muted">No placed subjects.</div> : null}
            </div>
          </div>
        </Block>
      ) : null}

      <Dist title="Characters" dist={ins.characters} />
      <Dist title="Environments" dist={ins.environments} />
      <Dist title="Palette families" dist={ins.paletteFamilies} />
      <Dist title="Composition" dist={ins.presets} />
      <Dist title="Viewpoint" dist={ins.cameraAngles} />

      <Block title="Repeated patterns">
        {ins.repeatedPatterns.length ? (
          <ul className="space-y-2">
            {ins.repeatedPatterns.map((p, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="text-text-secondary">{p.description}</span>
                <span className="shrink-0 font-mono text-[11px] text-text-muted tabular-nums">×{p.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[12px] text-text-muted">No pattern repeats often enough to flag.</div>
        )}
      </Block>

      {ins.suggestions.length ? (
        <Block title="Underused">
          <ul className="divide-y divide-border rounded-md border border-border">
            {ins.suggestions.map((s) => (
              <li key={`${s.kind}:${s.key}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] text-foreground">{s.label}</div>
                  <div className="truncate text-[11.5px] text-text-muted">
                    {kindLabel(s.kind)} · {s.reason}
                  </div>
                </div>
                <Button asChild size="xs" variant="ghost" className="shrink-0 text-text-secondary">
                  <Link href={`/studio?suggest=${encodeURIComponent(`${s.kind}:${s.key}`)}`}>
                    Try in Create <ArrowUpRight />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
    </div>
  );
}

function kindLabel(k: CollectionInsights["suggestions"][number]["kind"]) {
  return k === "composition" ? "Composition" : k === "anchor" ? "Placement" : k === "angle" ? "Viewpoint" : "Character";
}

function Cell({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-surface px-3.5 py-3">
      <MetaLabel>{label}</MetaLabel>
      <div className="mt-1 font-mono text-[17px] text-foreground tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] leading-4 text-text-muted">{hint}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <MetaLabel>{title}</MetaLabel>
      {children}
    </section>
  );
}

function Bar({ label, share, value }: { label: string; share: number; value: string }) {
  return (
    <div className="grid grid-cols-[96px_1fr_40px] items-center gap-3 text-[12px]">
      <span className="truncate text-text-secondary" title={label}>
        {label}
      </span>
      <span className="relative h-1 overflow-hidden rounded-full bg-elevated">
        <span className="absolute inset-y-0 left-0 rounded-full bg-text-muted" style={{ width: `${Math.max(share > 0 ? 2 : 0, share * 100)}%` }} />
      </span>
      <span className="text-right font-mono text-[11px] text-text-muted tabular-nums">{value}</span>
    </div>
  );
}

function Dist({ title, dist }: { title: string; dist: Distribution }) {
  const [all, setAll] = React.useState(false);
  if (!dist.length) return null;
  const shown = all ? dist : dist.slice(0, 6);
  return (
    <Block title={title}>
      <div className="space-y-2">
        {shown.map((d) => (
          <Bar key={d.key} label={d.label} share={d.share} value={String(d.count)} />
        ))}
      </div>
      {dist.length > 6 ? (
        <button type="button" onClick={() => setAll((a) => !a)} className="text-[11.5px] text-text-muted hover:text-text-secondary" aria-expanded={all}>
          {all ? "Show fewer" : `Show all ${dist.length}`}
        </button>
      ) : null}
    </Block>
  );
}
