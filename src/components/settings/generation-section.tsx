"use client";

import * as React from "react";
import type { Preferences } from "@/lib/domain/schemas";
import { ASPECT_OPTIONS, FORMATS, QUALITIES, type Quality } from "@/lib/domain/vocab";
import { qualityLabel } from "@/lib/providers/image/models";
import { useApp, useProfiles, useProviders } from "@/stores/app";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberField, savePreferences, Segmented, SettingRow, SettingsSection } from "./controls";

const NONE = "__none";
const DEFAULT_MODEL = "__default";

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", ok ? "bg-success" : "bg-text-muted/50")} aria-hidden />;
}

export function GenerationSection({ prefs }: { prefs: Preferences }) {
  const d = prefs.defaults;
  const profiles = useProfiles().filter((p) => !p.archived);
  const providers = useProviders();
  const textAssist = useApp((s) => s.data?.textAssist);
  const provider = providers.find((p) => p.id === d.provider) ?? providers[0];
  const models = provider?.models ?? [];
  const known = !d.model || models.some((m) => m.id === d.model);
  const defaultModel = models.find((m) => m.id === provider?.defaultModel);
  const [customDraft, setCustomDraft] = React.useState(known ? "" : (d.model ?? ""));

  const save = (defaults: Partial<Preferences["defaults"]>) => savePreferences({ defaults });

  return (
    <SettingsSection id="generation" title="Generation defaults" description="Starting values for new scenes. Each scene can override them in the Studio.">
      <SettingRow label="Default Style DNA" hint="Applied to new scenes. Switch the active profile any time from the command palette." htmlFor="set-style">
        <Select value={d.styleProfileId && profiles.some((p) => p.id === d.styleProfileId) ? d.styleProfileId : NONE} onValueChange={(v) => void save({ styleProfileId: v === NONE ? null : v })}>
          <SelectTrigger id="set-style" size="sm" className="w-64 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-[12.5px]">
                {p.name}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={NONE} className="text-[12.5px]">
              No Style DNA
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="Aspect ratio" htmlFor="set-aspect">
        <Select value={d.aspectRatio} onValueChange={(v) => void save({ aspectRatio: v as Preferences["defaults"]["aspectRatio"] })}>
          <SelectTrigger id="set-aspect" size="sm" className="w-64 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {ASPECT_OPTIONS.map((o) => (
              <SelectItem key={o.key} value={o.key} className="text-[12.5px]">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="Long edge" hint="512 to 3840 px. Mapped to the nearest size the selected model supports when generating." htmlFor="set-edge">
        <NumberField id="set-edge" value={d.longEdge} min={512} max={3840} suffix="px" onCommit={(v) => void save({ longEdge: v })} />
      </SettingRow>

      <SettingRow label="Quality" hint="Higher quality costs more and takes longer. Unsupported levels fall back per model." htmlFor="set-quality">
        <Select value={d.quality} onValueChange={(v) => void save({ quality: v as Quality })}>
          <SelectTrigger id="set-quality" size="sm" className="w-64 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {QUALITIES.map((q) => (
              <SelectItem key={q} value={q} className="text-[12.5px]">
                {qualityLabel(q)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="Format">
        <Segmented
          name="set-format"
          label="Image format"
          value={d.format}
          options={FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))}
          onChange={(format) => void save({ format })}
        />
      </SettingRow>

      <SettingRow
        label="Live previews"
        hint="Rough versions of the image streamed while it generates, shown blurred behind the loader and used to steady the progress estimate. Single-image requests only. OpenAI bills each one as 100 extra image output tokens, about $0.003 at current prices."
      >
        <Segmented
          name="set-partials"
          label="Live previews per image"
          value={String(d.partialImages ?? 2)}
          options={[
            { value: "0", label: "Off" },
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
          ]}
          onChange={(v) => void save({ partialImages: Number(v) })}
        />
      </SettingRow>

      <SettingRow label="Provider" hint="Unconfigured providers can be selected but cannot generate until their keys are set on the server." stacked>
        <div role="radiogroup" aria-label="Image provider" className="grid gap-2 sm:grid-cols-2">
          {providers.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-md border border-border bg-surface px-3.5 py-3 transition-colors hover:bg-elevated",
                "has-[:checked]:border-text-muted has-[:checked]:bg-elevated has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-text-secondary",
              )}
            >
              <input
                type="radio"
                name="set-provider"
                value={p.id}
                checked={d.provider === p.id}
                onChange={() => void save({ provider: p.id, model: null })}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-foreground">{p.label}</span>
                <span className="flex items-center gap-1.5 text-[11.5px] text-text-muted">
                  <StatusDot ok={p.configured} />
                  {p.configured ? "Configured" : "Not configured"}
                </span>
              </span>
              <span className="text-[11.5px] leading-relaxed text-text-muted">{p.hint}</span>
            </label>
          ))}
        </div>
      </SettingRow>

      {provider ? (
        <SettingRow label="Model" hint={`Models offered by ${provider.label}. Capabilities and prices come from Elsewhere's model registry.`} stacked>
          <div role="radiogroup" aria-label="Image model" className="overflow-hidden rounded-md border border-border">
            {[{ id: DEFAULT_MODEL, label: `Provider default`, description: defaultModel ? `Currently ${defaultModel.label}.` : "Chosen by the server.", recommended: false, unverified: false }, ...models].map((m) => {
              const checked = m.id === DEFAULT_MODEL ? !d.model : d.model === m.id;
              return (
                <label
                  key={m.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 border-b border-border px-3.5 py-2.5 transition-colors last:border-b-0 hover:bg-surface",
                    "has-[:checked]:bg-elevated has-[:focus-visible]:outline-1 has-[:focus-visible]:-outline-offset-1 has-[:focus-visible]:outline-text-secondary",
                  )}
                >
                  <input
                    type="radio"
                    name="set-model"
                    value={m.id}
                    checked={checked}
                    onChange={() => {
                      setCustomDraft("");
                      void save({ model: m.id === DEFAULT_MODEL ? null : m.id });
                    }}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn("mt-1 flex size-3 shrink-0 items-center justify-center rounded-full border", checked ? "border-foreground" : "border-text-muted/60")}
                  >
                    {checked ? <span className="size-1.5 rounded-full bg-foreground" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[12.5px] text-foreground">{m.label}</span>
                      {m.id !== DEFAULT_MODEL ? <span className="font-mono text-[10.5px] text-text-muted">{m.id}</span> : null}
                      {m.recommended ? <span className="text-[10.5px] text-success">Recommended</span> : null}
                      {m.unverified ? <span className="text-[10.5px] text-warning">Unverified</span> : null}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-text-muted">{m.description}</span>
                  </span>
                </label>
              );
            })}
            {!known ? (
              <div className="flex items-start gap-3 bg-elevated px-3.5 py-2.5">
                <span aria-hidden className="mt-1 flex size-3 shrink-0 items-center justify-center rounded-full border border-foreground">
                  <span className="size-1.5 rounded-full bg-foreground" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-foreground">{d.model}</span>
                    <span className="text-[10.5px] text-warning">Unverified</span>
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-text-muted">
                    Not in the model registry. It runs with conservative settings: standard sizes and one image per request.
                  </span>
                </span>
              </div>
            ) : null}
          </div>
          {provider.id === "openai" ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = customDraft.trim();
                if (v) void save({ model: v });
              }}
            >
              <label htmlFor="set-custom-model" className="shrink-0 text-[12px] text-text-secondary">
                Custom model ID
              </label>
              <Input
                id="set-custom-model"
                value={customDraft}
                maxLength={80}
                onChange={(e) => setCustomDraft(e.target.value)}
                placeholder="For a model released after this build"
                className="h-7 flex-1 font-mono text-[12px] md:text-[12px]"
              />
              <button
                type="submit"
                disabled={!customDraft.trim() || customDraft.trim() === d.model}
                className="h-7 shrink-0 rounded-md border border-border px-2.5 text-[12px] text-text-secondary hover:bg-surface hover:text-foreground disabled:opacity-40"
              >
                Use model
              </button>
            </form>
          ) : null}
        </SettingRow>
      ) : null}

      <SettingRow
        label="Text model"
        hint={`Used for AI concepts, prompt refinement and reviews. Leave empty to use the server default${textAssist?.model ? ` (${textAssist.model})` : ""}.`}
        htmlFor="set-text-model"
      >
        <Input
          key={d.textModel ?? ""}
          id="set-text-model"
          defaultValue={d.textModel ?? ""}
          maxLength={80}
          placeholder={textAssist?.model ?? "Server default"}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if ((v || null) !== d.textModel) void save({ textModel: v || null });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="h-8 w-64 font-mono text-[12px] md:text-[12px]"
        />
      </SettingRow>
    </SettingsSection>
  );
}
