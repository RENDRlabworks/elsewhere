"use client";

import * as React from "react";
import Link from "next/link";
import { Dices, Lock, Plus, Redo2, Undo2, X } from "lucide-react";
import { characterSchema, type Character, type SceneContent, type SceneField } from "@/lib/domain/schemas";
import {
  CAMERA_ANGLE_OPTIONS,
  CHARACTER_OPTIONS,
  COMPOSITION_PRESET_OPTIONS,
  DIRECTION_OPTIONS,
  HUMAN_KINDS,
  MOVEMENT_OPTIONS,
  REFERENCE_ROLE_OPTIONS,
  RELATIONSHIP_OPTIONS,
  TIME_OPTIONS,
  type CompositionPreset,
} from "@/lib/domain/vocab";
import {
  ATMOSPHERE_SUGGESTIONS,
  characterSuggestions,
  EMOTIONAL_TONE_SUGGESTIONS,
  ENVIRONMENT_SUGGESTIONS,
  LIGHTING_SUGGESTIONS,
  MATERIAL_SUGGESTIONS,
  NATURAL_ELEMENT_SUGGESTIONS,
} from "@/lib/explore/suggestions";
import {
  cameraDistanceLanguage,
  depthLanguage,
  environmentalScaleLanguage,
  foregroundScaleLanguage,
  scaleExaggerationLanguage,
  subjectHeightLanguage,
} from "@/lib/prompt/language";
import { useResource } from "@/lib/client/resource";
import { assetSrc } from "@/lib/client/api";
import type { CollectionInsights } from "@/lib/composition/analytics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, IconButton, MetaLabel } from "@/components/common/primitives";
import { PaletteEditor } from "@/components/palette/palette-editor";
import { useProfiles } from "@/stores/app";
import { useStudio } from "@/stores/studio";
import { CompositionPad } from "./composition-pad";
import { heightToSlider, PanelSection, SelectField, SliderField, sliderToHeight, TextField } from "./fields";
import { IdeaButton } from "./idea-button";
import { OutputSection } from "./output-section";
import { StartingImageSection } from "./starting-image";
import { applySubjectChange } from "./subject-sync";
import type { StudioSession } from "./use-studio-session";

function useField() {
  const scene = useStudio((s) => s.scene);
  const update = useStudio((s) => s.update);
  const toggleLockedField = useStudio((s) => s.toggleLockedField);
  const lock = (f: SceneField) => ({ locked: scene.lockedFields.includes(f), onToggleLock: () => toggleLockedField(f) });
  return { scene, update, lock };
}

function CharacterEditor({
  value,
  onChange,
  compact,
  slot = "subject",
}: {
  value: Character;
  onChange: (c: Character) => void;
  compact?: boolean;
  slot?: "subject" | "secondarySubject";
}) {
  const set = (p: Partial<Character>) => onChange({ ...value, ...p });
  // A typed description is followed through the scene once, when the field loses focus.
  const labelAtFocus = React.useRef<Character | null>(null);
  const isHuman = HUMAN_KINDS.includes(value.kind);
  if (value.kind === "none") {
    return (
      <SelectField label="Character" value={value.kind} options={CHARACTER_OPTIONS} onChange={(kind) => set({ kind })} hint="The environment itself is the subject." />
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <SelectField label="Character" value={value.kind} options={CHARACTER_OPTIONS} onChange={(kind) => set({ kind })} />
        <TextField
          label={value.kind === "object" ? "Object" : "Description"}
          value={value.label}
          onChange={(label) => set({ label })}
          placeholder={value.kind === "object" ? "a red umbrella" : "optional"}
          suggestions={characterSuggestions("subjectLabel", value.kind)}
          onFocus={() => {
            labelAtFocus.current = useStudio.getState().scene[slot];
          }}
          onBlur={() => {
            const before = labelAtFocus.current;
            labelAtFocus.current = null;
            const now = useStudio.getState().scene[slot];
            if (before && now && before.label.trim() !== now.label.trim()) applySubjectChange(slot, now, before);
          }}
          trailing={<IdeaButton field="subjectLabel" slot={slot} label={value.kind === "object" ? "Object" : "Description"} />}
        />
      </div>
      <TextField
        label="Action"
        value={value.action}
        onChange={(action) => set({ action })}
        placeholder="pausing mid-step, looking up"
        suggestions={characterSuggestions("action", value.kind)}
        trailing={<IdeaButton field="action" slot={slot} label="Action" />}
      />
      {!compact ? <TextField label="Pose" value={value.pose} onChange={(pose) => set({ pose })} placeholder="optional" suggestions={characterSuggestions("pose", value.kind)} trailing={<IdeaButton field="pose" slot={slot} label="Pose" />} /> : null}
      <div className="grid grid-cols-2 gap-2">
        <SelectField label="Direction" value={value.direction} options={DIRECTION_OPTIONS} onChange={(direction) => set({ direction })} />
        <SelectField label="Movement" value={value.movement} options={MOVEMENT_OPTIONS} onChange={(movement) => set({ movement })} />
      </div>
      <SelectField label="Relationship to environment" value={value.relationship} options={RELATIONSHIP_OPTIONS} onChange={(relationship) => set({ relationship })} />
      <div className="grid grid-cols-[1fr_88px] gap-3">
        <SliderField
          label="Silhouette strength"
          value={value.silhouetteStrength}
          onChange={(silhouetteStrength) => set({ silhouetteStrength })}
          display={`${value.silhouetteStrength}`}
        />
        <Field label="Count">
          <div className="flex h-8 items-center rounded-md border border-input">
            <button type="button" aria-label="Fewer" className="h-full px-2 text-text-muted hover:text-foreground" onClick={() => set({ count: Math.max(1, value.count - 1) })}>
              −
            </button>
            <span className="flex-1 text-center font-mono text-[12px] tabular-nums">{value.count}</span>
            <button type="button" aria-label="More" className="h-full px-2 text-text-muted hover:text-foreground" onClick={() => set({ count: Math.min(12, value.count + 1) })}>
              +
            </button>
          </div>
        </Field>
      </div>
      {isHuman || value.kind === "object" ? (
        <TextField
          label={value.kind === "object" ? "Material and finish" : "Clothing"}
          value={value.clothing}
          onChange={(clothing) => set({ clothing })}
          placeholder={value.kind === "object" ? "weathered painted wood" : "a long grey wool coat"}
          suggestions={characterSuggestions("clothing", value.kind)}
          trailing={<IdeaButton field="clothing" slot={slot} label={value.kind === "object" ? "Material and finish" : "Clothing"} />}
        />
      ) : null}
    </div>
  );
}

function SceneSection() {
  const { scene, update, lock } = useField();
  const profiles = useProfiles();
  const { data: templates } = useResource<{ templates: { id: string; name: string }[] }>("/api/prompt-templates");
  const profile = profiles.find((p) => p.id === scene.styleProfileId);
  return (
    <PanelSection id="scene" title="Scene">
      <TextField label="Title" value={scene.title} onChange={(title) => update({ title })} {...lock("title")} trailing={<IdeaButton field="title" label="Title" />} />
      <TextField
        label="Description"
        value={scene.description}
        onChange={(description) => update({ description })}
        multiline
        rows={2}
        placeholder="A fox beneath a monumental dandelion."
        {...lock("description")}
        trailing={<IdeaButton field="description" label="Description" />}
      />
      <TextField
        label="Free direction"
        value={scene.freeDirection}
        onChange={(freeDirection) => update({ freeDirection })}
        multiline
        rows={2}
        placeholder="Anything the structured controls do not capture."
        trailing={<IdeaButton field="freeDirection" label="Free direction" />}
      />
      <Field
        label="Style DNA"
        trailing={profile?.locked ? <Lock className="size-3 text-warning" aria-label="Profile locked" /> : null}
        hint={profile ? <Link href={`/style-dna/${profile.id}`} className="hover:text-text-secondary">v{profile.currentVersion} · edit profile</Link> : "No style applied"}
      >
        <Select value={scene.styleProfileId ?? "none"} onValueChange={(v) => update({ styleProfileId: v === "none" ? null : v })}>
          <SelectTrigger size="sm" className="h-8 w-full text-[12.5px]" aria-label="Style DNA">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Style DNA</SelectItem>
            {profiles
              .filter((p) => !p.archived || p.id === scene.styleProfileId)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>
      {templates?.templates.length ? (
        <Field label="Prompt template">
          <Select value={scene.promptTemplateId ?? "default"} onValueChange={(v) => update({ promptTemplateId: v === "default" ? null : v })}>
            <SelectTrigger size="sm" className="h-8 w-full text-[12.5px]" aria-label="Prompt template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Standard structure</SelectItem>
              {templates.templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
    </PanelSection>
  );
}

/** Kind changes follow through the scene at once; typed descriptions follow on blur. */
function onCharacter(slot: "subject" | "secondarySubject", next: Character) {
  const prev = useStudio.getState().scene[slot];
  if (prev && prev.kind !== next.kind) applySubjectChange(slot, next);
  else useStudio.getState().update({ [slot]: next });
}

function SubjectSection() {
  const { scene, update, lock } = useField();
  const l = lock("subject");
  return (
    <PanelSection
      id="subject"
      title="Subject"
      aside={<LockChip {...l} label="subject" />}
    >
      <CharacterEditor value={scene.subject} onChange={(subject) => onCharacter("subject", subject)} />
      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-secondary">Secondary subject</span>
          <Switch
            checked={!!scene.secondarySubject}
            onCheckedChange={(on) => update({ secondarySubject: on ? characterSchema.parse({ kind: "bird", relationship: "observing" }) : null })}
            aria-label="Include a secondary subject"
          />
        </div>
        {scene.secondarySubject ? (
          <div className="mt-3">
            <CharacterEditor compact slot="secondarySubject" value={scene.secondarySubject} onChange={(secondarySubject) => onCharacter("secondarySubject", secondarySubject)} />
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-text-muted">Only when the scene genuinely needs two subjects.</p>
        )}
      </div>
    </PanelSection>
  );
}

function LockChip({ locked, onToggleLock, label }: { locked: boolean; onToggleLock: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggleLock}
      aria-pressed={locked}
      className={cn(
        "flex h-5 items-center gap-1 rounded-sm px-1.5 text-[10.5px] transition-colors",
        locked ? "bg-warning/10 text-warning" : "text-text-muted/70 hover:text-text-secondary",
      )}
      aria-label={`${locked ? "Unlock" : "Lock"} ${label} during randomization`}
    >
      <Lock className="size-2.5" />
      {locked ? "Locked" : "Lock"}
    </button>
  );
}

function WorldSection() {
  const { scene, update, lock } = useField();
  return (
    <PanelSection id="world" title="World">
      <TextField label="Environment" value={scene.environment} onChange={(environment) => update({ environment })} suggestions={ENVIRONMENT_SUGGESTIONS} placeholder="an ancient pine forest at the edge of a cliff" {...lock("environment")} trailing={<IdeaButton field="environment" label="Environment" />} />
      <TextField
        label="Impossible phenomenon"
        value={scene.phenomenon}
        onChange={(phenomenon) => update({ phenomenon })}
        multiline
        rows={2}
        placeholder="an inverted mountain range hanging from the sky"
        {...lock("phenomenon")}
        trailing={<IdeaButton field="phenomenon" label="Impossible phenomenon" />}
      />
      <div className="grid grid-cols-2 gap-2">
        <TextField label="Natural element" value={scene.naturalElement} onChange={(naturalElement) => update({ naturalElement })} suggestions={NATURAL_ELEMENT_SUGGESTIONS} {...lock("naturalElement")} trailing={<IdeaButton field="naturalElement" label="Natural element" />} />
        <SelectField label="Time of day" value={scene.timeOfDay} options={TIME_OPTIONS} onChange={(timeOfDay) => update({ timeOfDay })} {...lock("timeOfDay")} />
      </div>
      <TextField label="Materials" value={scene.materials} onChange={(materials) => update({ materials })} suggestions={MATERIAL_SUGGESTIONS} placeholder="wet basalt, velvet moss" {...lock("materials")} trailing={<IdeaButton field="materials" label="Materials" />} />
      <TextField label="Lighting" value={scene.lighting} onChange={(lighting) => update({ lighting })} suggestions={LIGHTING_SUGGESTIONS} placeholder="soft moonlight from behind the subject" {...lock("lighting")} trailing={<IdeaButton field="lighting" label="Lighting" />} />
      <TextField label="Atmosphere" value={scene.atmosphere} onChange={(atmosphere) => update({ atmosphere })} suggestions={ATMOSPHERE_SUGGESTIONS} {...lock("atmosphere")} trailing={<IdeaButton field="atmosphere" label="Atmosphere" />} />
      <TextField label="Emotional tone" value={scene.emotionalTone} onChange={(emotionalTone) => update({ emotionalTone })} suggestions={EMOTIONAL_TONE_SUGGESTIONS} {...lock("emotionalTone")} trailing={<IdeaButton field="emotionalTone" label="Emotional tone" />} />
    </PanelSection>
  );
}

function CompositionSection() {
  const { scene, update, lock } = useField();
  const sceneId = useStudio((s) => s.sceneId);
  const { data } = useResource<{ insights: CollectionInsights }>(sceneId ? `/api/insights?sceneId=${sceneId}` : "/api/insights");
  const c = scene.composition;
  const set = (p: Partial<SceneContent["composition"]>) => update({ composition: { ...c, ...p } });
  const hasSubject = scene.subject.kind !== "none";
  const suggestions = data?.insights.suggestions.filter((s) => s.kind === "composition" && s.key !== c.preset).slice(0, 3) ?? [];
  const l = lock("composition");
  return (
    <PanelSection id="composition" title="Composition and scale" aside={<LockChip {...l} label="composition" />}>
      <CompositionPad
        value={c}
        aspectRatio={scene.output.aspectRatio}
        onChange={set}
        hasSubject={hasSubject}
        heatmap={sceneId && data?.insights.analysed ? data.insights.heatmap : undefined}
      />
      <div>
        <MetaLabel className="mb-2">Preset</MetaLabel>
        <div className="flex flex-wrap gap-1">
          {COMPOSITION_PRESET_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={c.preset === o.key}
              onClick={() => set({ preset: c.preset === o.key ? null : (o.key as CompositionPreset) })}
              className={cn(
                "h-6 rounded-sm border px-2 text-[11.5px] transition-colors",
                c.preset === o.key ? "border-text-secondary bg-interactive text-foreground" : "border-border text-text-secondary hover:border-text-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {suggestions.length ? (
          <div className="mt-2 text-[11px] text-text-muted">
            Underused{sceneId ? " here" : ""}:{" "}
            {suggestions.map((s, i) => (
              <React.Fragment key={s.key}>
                {i ? ", " : ""}
                <button type="button" className="text-text-secondary underline-offset-2 hover:underline" onClick={() => set({ preset: s.key as CompositionPreset })}>
                  {s.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        ) : null}
      </div>
      <SelectField label="Camera angle" value={c.cameraAngle} options={CAMERA_ANGLE_OPTIONS} onChange={(cameraAngle) => set({ cameraAngle })} />
      {hasSubject ? (
        <SliderField
          label="Subject height"
          value={heightToSlider(c.subjectHeight)}
          min={0}
          max={100}
          step={0.5}
          onChange={(t) => set({ subjectHeight: sliderToHeight(t) })}
          display={`${c.subjectHeight}% of frame`}
          describe={subjectHeightLanguage(c.subjectHeight)}
        />
      ) : null}
      <SliderField label="Environmental scale" value={c.environmentalScale} onChange={(environmentalScale) => set({ environmentalScale })} describe={environmentalScaleLanguage(c.environmentalScale)} />
      <SliderField label="Scale exaggeration" value={c.scaleExaggeration} onChange={(scaleExaggeration) => set({ scaleExaggeration })} describe={scaleExaggerationLanguage(c.scaleExaggeration)} />
      <SliderField label="Camera distance" value={c.cameraDistance} onChange={(cameraDistance) => set({ cameraDistance })} describe={cameraDistanceLanguage(c.cameraDistance)} />
      <SliderField label="Perceived depth" value={c.depth} onChange={(depth) => set({ depth })} describe={depthLanguage(c.depth)} />
      <SliderField label="Foreground scale" value={c.foregroundScale} onChange={(foregroundScale) => set({ foregroundScale })} describe={foregroundScaleLanguage(c.foregroundScale)} />
      <p className="text-[11px] leading-snug text-text-muted">Positions and sizes are described to the model in words. Image models interpret them approximately, not to the pixel.</p>
    </PanelSection>
  );
}

function PaletteSection({ session }: { session: StudioSession }) {
  const { scene, update, lock } = useField();
  const sceneText = [scene.environment, scene.phenomenon, scene.materials, scene.naturalElement, scene.description].join(" ");
  const refs = session.references
    .filter((r) => r.asset?.dominantColors.length && (r.profileId === scene.styleProfileId || scene.referenceIds.includes(r.id)))
    .map((r) => ({ id: r.id, label: r.label, hexes: r.asset!.dominantColors }));
  const l = lock("palette");
  return (
    <PanelSection id="palette" title="Palette" aside={<LockChip {...l} label="palette" />}>
      <PaletteEditor
        value={scene.palette}
        onChange={(palette) => update({ palette: { ...scene.palette, ...palette } })}
        sceneText={sceneText}
        styleHexes={session.profile?.defaultPalette.map((s) => s.hex)}
        references={refs}
      />
    </PanelSection>
  );
}

function ReferencesSection({ session }: { session: StudioSession }) {
  const { scene, update } = useField();
  const pool = session.references.filter((r) => r.profileId === scene.styleProfileId || scene.referenceIds.includes(r.id));
  const supports = !!session.model?.capabilities.referenceImages;
  const toggle = (id: string) =>
    update({ referenceIds: scene.referenceIds.includes(id) ? scene.referenceIds.filter((x) => x !== id) : [...scene.referenceIds, id] });
  return (
    <PanelSection id="references" title="References" defaultOpen={false} aside={<span className="font-mono text-[11px] text-text-muted">{scene.referenceIds.length}</span>}>
      {!supports && session.model ? (
        <p className="text-[11.5px] text-warning/90">
          {session.model.label} does not accept reference images. Selected references will not be submitted.
        </p>
      ) : null}
      {pool.length ? (
        <div className="grid grid-cols-3 gap-2">
          {pool.map((r) => {
            const on = scene.referenceIds.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                aria-pressed={on}
                className={cn("group relative overflow-hidden rounded-sm border text-left", on ? "border-foreground" : "border-border opacity-60 hover:opacity-100")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetSrc(r.assetId)!} alt={r.label} className="aspect-square w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-[9.5px] text-text-secondary">
                  {REFERENCE_ROLE_OPTIONS.find((o) => o.key === r.role)?.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[11.5px] text-text-muted">
          No references on this Style DNA yet.{" "}
          {scene.styleProfileId ? (
            <Link href={`/style-dna/${scene.styleProfileId}`} className="text-text-secondary hover:underline">
              Add references
            </Link>
          ) : null}
        </p>
      )}
    </PanelSection>
  );
}

export function ScenePanel({ session }: { session: StudioSession }) {
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const lockedCount = useStudio((s) => s.scene.lockedFields.length);
  const clearLocks = () => useStudio.getState().update({ lockedFields: [] });
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="pl-1 text-[12px] font-medium text-text-secondary">Scene direction</span>
        <div className="flex items-center gap-0.5">
          <IconButton icon={Undo2} label="Undo" shortcut="⌘Z" disabled={!canUndo} onClick={undo} />
          <IconButton icon={Redo2} label="Redo" shortcut="⇧⌘Z" disabled={!canRedo} onClick={redo} />
          <IconButton icon={Plus} label="New scene" onClick={() => void session.newScene()} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <StartingImageSection session={session} />
        <SceneSection />
        <SubjectSection />
        <WorldSection />
        <CompositionSection />
        <PaletteSection session={session} />
        <ReferencesSection session={session} />
        <OutputSection session={session} />
      </div>
      <div className="shrink-0 space-y-2 border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="flex-1" disabled={session.randomizing} onClick={() => void session.randomize()}>
            <Dices /> {lockedCount ? "Randomize unlocked" : "Randomize"}
          </Button>
          {lockedCount ? (
            <IconButton icon={X} label={`Clear ${lockedCount} lock${lockedCount > 1 ? "s" : ""}`} onClick={clearLocks} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
