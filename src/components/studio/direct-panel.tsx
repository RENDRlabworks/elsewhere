"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Dices, LoaderCircle, Plus, Redo2, Sparkles, Undo2, X } from "lucide-react";
import type { SceneField } from "@/lib/domain/schemas";
import { CHARACTER_OPTIONS } from "@/lib/domain/vocab";
import { effectiveSwatches } from "@/lib/palette/engine";
import { assetSrc } from "@/lib/client/api";
import { cn, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { IconButton } from "@/components/common/primitives";
import { useApp, useProfiles } from "@/stores/app";
import { useStudio } from "@/stores/studio";
import { OutputSection } from "./output-section";
import {
  CompositionSection,
  PaletteEssentials,
  PhenomenonEssentials,
  ReferencesSection,
  SceneSection,
  SettingEssentials,
  SubjectDetailsSection,
  SubjectEssentials,
  WorldDetailsSection,
} from "./scene-panel";
import { StartingImageSection } from "./starting-image";
import { usePlanPreview, type StudioSession } from "./use-studio-session";

type ChipId = "look" | "subject" | "colour" | "setting" | "phenomenon";

/**
 * One direction control: a label and a plain-language summary of the current value.
 * Tapping it opens the editor in place; only one is open at a time.
 */
function Chip({
  id,
  label,
  open,
  onToggle,
  locked,
  summary,
  children,
}: {
  id: ChipId;
  label: string;
  open: boolean;
  onToggle: (id: ChipId) => void;
  locked?: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const bodyId = `chip-${id}`;
  return (
    <div className={cn("rounded-xl transition-colors", open ? "bg-surface" : "hover:bg-surface/60")}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-start gap-3 rounded-xl px-3.5 py-3 text-left outline-none focus-visible:ring-1 focus-visible:ring-text-secondary"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] tracking-[0.08em] text-text-muted uppercase">
            {label}
            {locked ? <span className="text-warning normal-case tracking-normal">· locked</span> : null}
          </span>
          <span className="mt-1 block text-[14px] leading-snug text-foreground">{summary}</span>
        </span>
        <ChevronDown className={cn("mt-4 size-4 shrink-0 text-text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={bodyId} className="space-y-4 px-3.5 pt-1 pb-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

const muted = (s: string) => <span className="text-text-muted">{s}</span>;
const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The Look (Style DNA) picker: each look shown with its own reference images. */
function LookPicker({ session, onPicked }: { session: StudioSession; onPicked: () => void }) {
  const styleProfileId = useStudio((s) => s.scene.styleProfileId);
  const update = useStudio((s) => s.update);
  const profiles = useProfiles().filter((p) => !p.archived || p.id === styleProfileId);
  const refsFor = (id: string) => session.references.filter((r) => r.profileId === id && r.enabled).slice(0, 3);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {profiles.map((p) => {
          const refs = refsFor(p.id);
          const on = p.id === styleProfileId;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                update({ styleProfileId: p.id });
                onPicked();
              }}
              className={cn(
                "group overflow-hidden rounded-lg bg-elevated text-left outline-none ring-offset-2 ring-offset-surface transition focus-visible:ring-1 focus-visible:ring-text-secondary",
                on ? "ring-1 ring-foreground" : "opacity-80 hover:opacity-100",
              )}
            >
              <span className="flex aspect-[3/2] w-full">
                {refs.length
                  ? refs.map((r) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={r.id} src={assetSrc(r.assetId)!} alt="" className="h-full min-w-0 flex-1 object-cover" />
                    ))
                  : p.defaultPalette.map((sw) => <span key={sw.id} className="h-full flex-1" style={{ background: sw.hex }} />)}
              </span>
              <span className="block truncate px-2.5 py-2 text-[12.5px] text-foreground">{p.name}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[12px]">
        <Link href="/style-dna" className="text-text-muted hover:text-text-secondary">
          Manage looks
        </Link>
        {styleProfileId ? (
          <Link href={`/style-dna/${styleProfileId}`} className="text-text-muted hover:text-text-secondary">
            Edit this look
          </Link>
        ) : null}
      </div>
    </div>
  );
}

const COUNTS = [1, 2, 4] as const;

function GenerateBar({ session }: { session: StudioSession }) {
  const scene = useStudio((s) => s.scene);
  const sceneId = useStudio((s) => s.sceneId);
  const update = useStudio((s) => s.update);
  const maxCount = useApp((s) => s.data?.preferences.limits.maxImagesPerRequest ?? 4);
  const { plan } = usePlanPreview(scene, sceneId);
  const count = scene.output.count;
  const cost = plan?.estimate.usd;
  return (
    <div className="shrink-0 space-y-3 px-4 pt-3 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg bg-surface p-0.5" role="radiogroup" aria-label="Images to generate">
          {COUNTS.filter((n) => n <= maxCount).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={count === n}
              onClick={() => update({ output: { ...scene.output, count: n } })}
              className={cn(
                "h-7 min-w-9 rounded-md px-2 text-[12.5px] tabular-nums transition-colors",
                count === n ? "bg-interactive text-foreground" : "text-text-muted hover:text-text-secondary",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-text-muted tabular-nums">
          {plan?.provider === "dev" ? "Sketch · free" : cost != null ? `About ${formatUsd(cost)}` : count > 1 ? `${count} images` : ""}
        </span>
      </div>
      <Button className="h-11 w-full rounded-xl text-[14px]" onClick={() => void session.generate()} disabled={session.generating} aria-keyshortcuts="Meta+Enter">
        {session.generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
        Generate{count > 1 ? ` ${count}` : ""}
        <Kbd className="ml-1 hidden bg-black/10 text-primary-foreground md:inline-flex">⌘↵</Kbd>
      </Button>
    </div>
  );
}

/**
 * The Create panel: start from an image, pick a look, set the four things that
 * change most (subject, colour, setting, phenomenon), and generate. Everything else
 * waits under Fine-tune.
 */
export function DirectPanel({ session }: { session: StudioSession }) {
  const scene = useStudio((s) => s.scene);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const profiles = useProfiles();
  const [open, setOpen] = React.useState<ChipId | null>(null);
  const [fineTune, setFineTune] = React.useState(false);
  const toggle = (id: ChipId) => setOpen((cur) => (cur === id ? null : id));
  const locked = (f: SceneField) => scene.lockedFields.includes(f);
  const lockedCount = scene.lockedFields.length;

  const look = profiles.find((p) => p.id === scene.styleProfileId);
  const lookRefs = look ? session.references.filter((r) => r.profileId === look.id && r.enabled).slice(0, 3) : [];
  const subject = scene.subject;
  const kindLabel = CHARACTER_OPTIONS.find((o) => o.key === subject.kind)?.label ?? subject.kind;
  const swatches = effectiveSwatches(scene.palette);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <span className="hidden text-[13px] text-text-secondary md:inline">Direct</span>
        <div className="flex items-center gap-0.5">
          <IconButton icon={Undo2} label="Undo" shortcut="⌘Z" disabled={!canUndo} onClick={undo} />
          <IconButton icon={Redo2} label="Redo" shortcut="⇧⌘Z" disabled={!canRedo} onClick={redo} />
          <IconButton icon={Plus} label="New scene" onClick={() => void session.newTab()} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
        <div className="px-1.5">
          <StartingImageSection session={session} />
        </div>

        <div className="mt-2 space-y-1">
          <Chip
            id="look"
            label="Look"
            open={open === "look"}
            onToggle={toggle}
            summary={
              <span className="flex items-center gap-2.5">
                {lookRefs.length ? (
                  <span className="flex shrink-0 overflow-hidden rounded">
                    {lookRefs.map((r) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={r.id} src={assetSrc(r.assetId)!} alt="" className="size-6 object-cover" />
                    ))}
                  </span>
                ) : null}
                <span className="truncate">{look?.name ?? "No look"}</span>
              </span>
            }
          >
            <LookPicker session={session} onPicked={() => setOpen(null)} />
          </Chip>

          <Chip
            id="subject"
            label="Subject"
            open={open === "subject"}
            onToggle={toggle}
            locked={locked("subject")}
            summary={
              subject.kind === "none" ? (
                muted("No character, the landscape is the subject")
              ) : (
                <>
                  {subject.label || kindLabel}
                  {subject.action ? <span className="text-text-secondary">, {clip(subject.action, 60)}</span> : null}
                </>
              )
            }
          >
            <SubjectEssentials />
          </Chip>

          <Chip
            id="colour"
            label="Colour"
            open={open === "colour"}
            onToggle={toggle}
            locked={locked("palette")}
            summary={
              swatches.length ? (
                <span className="flex h-5 w-full max-w-[220px] overflow-hidden rounded">
                  {swatches.map((h, i) => (
                    <span key={`${h}-${i}`} className="flex-1" style={{ background: h }} />
                  ))}
                </span>
              ) : (
                muted("From the look")
              )
            }
          >
            <PaletteEssentials session={session} />
          </Chip>

          <Chip
            id="setting"
            label="Setting"
            open={open === "setting"}
            onToggle={toggle}
            locked={locked("environment")}
            summary={scene.environment ? clip(scene.environment) : muted("Choose a place")}
          >
            <SettingEssentials />
          </Chip>

          <Chip
            id="phenomenon"
            label="Phenomenon"
            open={open === "phenomenon"}
            onToggle={toggle}
            locked={locked("phenomenon")}
            summary={scene.phenomenon ? clip(scene.phenomenon) : muted("Add the impossible element")}
          >
            <PhenomenonEssentials />
          </Chip>
        </div>

        <div className="mt-3 flex items-center gap-2 px-1.5">
          <Button variant="ghost" size="sm" className="text-text-secondary" disabled={session.randomizing} onClick={() => void session.randomize()}>
            <Dices /> {lockedCount ? "Surprise me (unlocked)" : "Surprise me"}
          </Button>
          {lockedCount ? (
            <IconButton icon={X} label={`Clear ${lockedCount} lock${lockedCount > 1 ? "s" : ""}`} onClick={() => useStudio.getState().update({ lockedFields: [] })} />
          ) : null}
        </div>

        <div className="mt-4 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setFineTune((v) => !v)}
            aria-expanded={fineTune}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] text-text-secondary hover:text-foreground"
          >
            Fine-tune
            <ChevronDown className={cn("size-4 text-text-muted transition-transform", fineTune && "rotate-180")} />
          </button>
          {fineTune ? (
            <div className="-mx-2.5">
              <SceneSection withStyle={false} defaultOpen={false} />
              <SubjectDetailsSection defaultOpen={false} />
              <WorldDetailsSection defaultOpen={false} />
              <CompositionSection defaultOpen={false} />
              <ReferencesSection session={session} />
              <OutputSection session={session} />
            </div>
          ) : null}
        </div>
      </div>

      <GenerateBar session={session} />
    </div>
  );
}
