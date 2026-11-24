"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import type { OutputSettings } from "@/lib/domain/schemas";
import { ASPECT_OPTIONS, BACKGROUNDS, FORMATS, type Option, type Quality } from "@/lib/domain/vocab";
import { qualityLabel } from "@/lib/providers/image/models";
import { formatUsd, cn } from "@/lib/utils";
import { Field, MetaLabel } from "@/components/common/primitives";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProviders } from "@/stores/app";
import { useStudio } from "@/stores/studio";
import { PanelSection, SelectField } from "./fields";
import { usePlanPreview, type StudioSession } from "./use-studio-session";

const LONG_EDGES = [1024, 1280, 1536, 2048, 2560, 3072, 3840];

export function OutputSection({ session }: { session: StudioSession }) {
  const scene = useStudio((s) => s.scene);
  const sceneId = useStudio((s) => s.sceneId);
  const update = useStudio((s) => s.update);
  const providers = useProviders();
  const o = scene.output;
  const set = (p: Partial<OutputSettings>) => update({ output: { ...o, ...p } });
  const { plan, error } = usePlanPreview(scene, sceneId);
  const model = session.model;
  const qualities: Option<Quality>[] = (model?.capabilities.qualities ?? ["auto", "low", "medium", "high"]).map((q) => ({ key: q, label: qualityLabel(q) }));
  const modelValue = `${o.provider}::${o.model ?? ""}`;

  return (
    <PanelSection id="output" title="Output">
      <Field label="Model">
        <Select
          value={modelValue}
          onValueChange={(v) => {
            const [provider, m] = v.split("::");
            set({ provider, model: m || null });
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-full text-[12.5px]" aria-label="Provider and model">
            <SelectValue placeholder="Choose a model" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectGroup key={p.id}>
                <SelectLabel className="label-meta">
                  {p.label}
                  {p.configured ? "" : " · not configured"}
                </SelectLabel>
                <SelectItem value={`${p.id}::`} disabled={!p.configured}>
                  Default ({p.models.find((m) => m.id === p.defaultModel)?.label ?? p.defaultModel})
                </SelectItem>
                {p.models.map((m) => (
                  <SelectItem key={m.id} value={`${p.id}::${m.id}`} disabled={!p.configured}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <SelectField label="Aspect ratio" value={o.aspectRatio} options={ASPECT_OPTIONS} onChange={(aspectRatio) => set({ aspectRatio })} />
        <SelectField
          label="Long edge"
          value={String(o.longEdge)}
          options={LONG_EDGES.map((e) => ({ key: String(e), label: `${e}px` }))}
          onChange={(v) => set({ longEdge: Number(v) })}
        />
        <SelectField label="Quality" value={o.quality} options={qualities} onChange={(quality) => set({ quality })} />
        <SelectField label="Format" value={o.format} options={FORMATS.map((f) => ({ key: f, label: f.toUpperCase() }))} onChange={(format) => set({ format })} />
        <SelectField
          label="Background"
          value={o.background}
          options={BACKGROUNDS.map((b) => ({ key: b, label: b === "auto" ? "Automatic" : b[0].toUpperCase() + b.slice(1) }))}
          onChange={(background) => set({ background })}
        />
        <Field label="Images">
          <div className="flex h-8 overflow-hidden rounded-md border border-input">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={o.count === n}
                onClick={() => set({ count: n })}
                className={cn("flex-1 font-mono text-[12px] transition-colors", o.count === n ? "bg-interactive text-foreground" : "text-text-muted hover:text-text-secondary")}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="rounded-md border border-border bg-surface p-3">
        <MetaLabel className="mb-2">Will submit</MetaLabel>
        {plan ? (
          <div className="space-y-1 font-mono text-[11.5px] text-text-secondary">
            <div className="flex justify-between gap-2">
              <span className="truncate">{plan.model.label}</span>
              <span>{plan.n}×</span>
            </div>
            <div className="flex justify-between">
              <span>
                {plan.width}×{plan.height}
              </span>
              <span>
                {qualityLabel(plan.quality as Quality)} · {plan.format.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{plan.referencesSubmitted ? `${plan.referenceCount} reference${plan.referenceCount > 1 ? "s" : ""} attached` : "Text prompt only"}</span>
              <span title={plan.estimate.basis}>
                {plan.estimate.usd != null ? formatUsd(plan.estimate.usd, plan.estimate.basis !== "free") : "Cost after run"}
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="text-[11.5px] text-warning">{error}</div>
        ) : (
          <div className="text-[11.5px] text-text-muted">Checking provider capabilities…</div>
        )}
        {plan?.notes.length ? (
          <ul className="mt-2 space-y-1 border-t border-border pt-2">
            {plan.notes.map((n) => (
              <li key={n} className="flex gap-1.5 text-[11px] leading-snug text-text-muted">
                <AlertTriangle className="mt-px size-3 shrink-0 text-warning/80" /> {n}
              </li>
            ))}
          </ul>
        ) : null}
        {plan?.estimate.basis === "unknown" && plan.provider !== "dev" ? (
          <p className="mt-2 text-[11px] text-text-muted">This model bills by tokens. The actual cost is recorded after the run.</p>
        ) : null}
      </div>
    </PanelSection>
  );
}
