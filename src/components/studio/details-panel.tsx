"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Copy, History, Palette, Star, Trash2, Wand2, X } from "lucide-react";
import type { Generation, ImageReview, ReferenceImage, StyleProfileVersion } from "@/lib/domain/schemas";
import { CHARACTER_OPTIONS, COMPOSITION_PRESET_OPTIONS, type ReviewStatus } from "@/lib/domain/vocab";
import { assetSrc, errorMessage } from "@/lib/client/api";
import { useResource } from "@/lib/client/resource";
import { cn, formatDateTime, formatDuration, formatUsd, titleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, MetaLabel, SwatchStrip } from "@/components/common/primitives";
import { deletePermanently, patchGeneration, STATUS_LABEL, useStyleReferencePicker } from "@/components/generation/actions";
import { useStudio } from "@/stores/studio";

export type GenerationDetail = {
  generation: Generation;
  parent: Generation | null;
  lineage: Generation[];
  collections: { id: string; name: string }[];
  reviews: ImageReview[];
  references: ReferenceImage[];
};

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-2 py-1">
      <dt className="text-[11.5px] text-text-muted">{label}</dt>
      <dd className={cn("min-w-0 text-[12px] break-words text-text-secondary", mono && "font-mono text-[11.5px]")}>{children}</dd>
    </div>
  );
}

/** Edits a metadata field on blur. Historical generation parameters are never touched. */
function useMetaField<T>(g: Generation, key: "title" | "notes", initial: T) {
  // The panel is keyed by image id, so local state resets when the selection changes.
  const [value, setValue] = React.useState(initial);
  const commit = async () => {
    if (value === initial) return;
    try {
      await patchGeneration(g.id, { [key]: value } as never);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return { value, setValue, commit };
}

function TagEditor({ g }: { g: Generation }) {
  const [draft, setDraft] = React.useState("");
  const save = async (tags: string[]) => {
    try {
      await patchGeneration(g.id, { tags });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {g.tags.map((t) => (
        <span key={t} className="flex h-5 items-center gap-1 rounded-sm bg-interactive pr-0.5 pl-1.5 text-[11px] text-text-secondary">
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} className="text-text-muted hover:text-foreground" onClick={() => void save(g.tags.filter((x) => x !== t))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
            e.preventDefault();
            void save([...g.tags, draft.trim()]);
            setDraft("");
          }
        }}
        placeholder="Add tag"
        aria-label="Add tag"
        className="h-5 min-w-[70px] flex-1 bg-transparent text-[11.5px] text-foreground outline-none placeholder:text-text-muted"
      />
    </div>
  );
}

function Rating({ g }: { g: Generation }) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={g.rating === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => void patchGeneration(g.id, { rating: g.rating === n ? 0 : n })}
          className="p-0.5 text-text-muted hover:text-foreground"
        >
          <Star className={cn("size-3.5", n <= g.rating && "fill-foreground text-foreground")} />
        </button>
      ))}
    </div>
  );
}

const REVIEW_OPTIONS: { key: ReviewStatus; label: string }[] = [
  { key: "unreviewed", label: "Unreviewed" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
];

export function DetailsPanel({ g, detail }: { g: Generation | null; detail: GenerationDetail | undefined }) {
  const router = useRouter();
  const select = useStudio((s) => s.select);
  const showStylePicker = useStyleReferencePicker((st) => st.show);
  const title = useMetaField(g ?? ({ id: "" } as Generation), "title", g?.title ?? "");
  const notes = useMetaField(g ?? ({ id: "" } as Generation), "notes", g?.notes ?? "");
  const [promptOpen, setPromptOpen] = React.useState(false);
  const { data: styleData } = useResource<{ versions: StyleProfileVersion[] }>(g?.styleProfileId ? `/api/styles/${g.styleProfileId}` : null);

  if (!g) return <EmptyState title="No image selected" description="Generated images and their full history appear here." />;
  const s = g.sceneSnapshot;
  const version = styleData?.versions.find((v) => v.id === g.styleVersionId);
  const lineage = detail?.lineage ?? [];

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-2">
        <Input
          value={title.value}
          onChange={(e) => title.setValue(e.target.value)}
          onBlur={() => void title.commit()}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-8 border-transparent bg-transparent px-1 text-[14px] font-medium hover:border-border focus-visible:border-border"
          aria-label="Image title"
        />
        <div className="flex items-center justify-between">
          <Rating g={g} />
          <div className="flex overflow-hidden rounded-md border border-border">
            {REVIEW_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={g.reviewStatus === o.key}
                onClick={() => void patchGeneration(g.id, { reviewStatus: o.key })}
                className={cn(
                  "h-6 px-2 text-[11px] transition-colors",
                  g.reviewStatus === o.key
                    ? o.key === "rejected"
                      ? "bg-danger/15 text-danger"
                      : o.key === "accepted"
                        ? "bg-success/15 text-success"
                        : "bg-interactive text-foreground"
                    : "text-text-muted hover:text-text-secondary",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {g.status === "completed" && g.assetId ? (
        <div className="flex flex-wrap gap-1">
          <Button size="xs" variant="secondary" onClick={() => router.push(`/studio?recreate=${g.id}`)}>
            <Wand2 /> Recreate in this style
          </Button>
          <Button size="xs" variant="ghost" className="text-text-secondary" onClick={() => showStylePicker([g.id])}>
            <Palette /> Use as style reference
          </Button>
        </div>
      ) : null}

      {g.isDevPlaceholder ? (
        <p className="rounded-md border border-warning/30 bg-warning/5 p-2 text-[11.5px] text-warning">
          Development sketch: a labelled composition study rendered without a provider. Configure OpenAI for real images.
        </p>
      ) : null}

      <section>
        <MetaLabel className="mb-1">Details</MetaLabel>
        <dl>
          <Row label="Status">{STATUS_LABEL[g.status]}</Row>
          <Row label="Dimensions" mono>{g.width && g.height ? `${g.width} × ${g.height}` : "n/a"}</Row>
          <Row label="Created">{formatDateTime(g.createdAt)}</Row>
          <Row label="Source">{g.source === "imported" ? "Imported original" : titleCase(g.kind)}</Row>
          {g.provider ? <Row label="Model" mono>{g.provider} / {g.model}</Row> : null}
          {g.outputSettings ? (
            <Row label="Settings" mono>
              {g.outputSettings.aspectRatio} · {g.outputSettings.quality} · {g.outputSettings.format}
            </Row>
          ) : null}
          {g.styleSnapshot ? (
            <Row label="Look">
              {g.styleProfileId ? <Link href={`/style-dna/${g.styleProfileId}`} className="hover:text-foreground">{g.styleSnapshot.name}</Link> : g.styleSnapshot.name}
              {version ? <span className="ml-1 font-mono text-text-muted">v{version.version}</span> : null}
            </Row>
          ) : null}
          {g.durationMs != null ? <Row label="Duration" mono>{formatDuration(g.durationMs)}</Row> : null}
          {g.costUsd != null || g.provider === "openai" ? (
            <Row label="Cost" mono>
              {g.costUsd != null ? formatUsd(g.costUsd, g.costEstimated) : "Not reported"}
            </Row>
          ) : null}
          {g.usage?.outputTokens ? <Row label="Tokens" mono>{g.usage.inputTokens ?? 0} in · {g.usage.outputTokens} out</Row> : null}
        </dl>
      </section>

      {s ? (
        <section className="space-y-2">
          <MetaLabel>Scene at generation</MetaLabel>
          <SwatchStrip hexes={g.paletteHexes} />
          <dl>
            <Row label="Subject">{CHARACTER_OPTIONS.find((o) => o.key === s.subject.kind)?.label}{s.subject.label ? `, ${s.subject.label}` : ""}</Row>
            {s.environment ? <Row label="Environment">{s.environment}</Row> : null}
            {s.phenomenon ? <Row label="Phenomenon">{s.phenomenon}</Row> : null}
            <Row label="Composition">
              {COMPOSITION_PRESET_OPTIONS.find((o) => o.key === s.composition.preset)?.label ?? "Free"} · subject {s.composition.subjectHeight}% at ({s.composition.x.toFixed(2)}, {s.composition.y.toFixed(2)})
            </Row>
          </dl>
          <Button size="xs" variant="ghost" className="-ml-2 text-text-secondary" onClick={() => router.push(`/studio?restore=${g.id}`)}>
            <History /> Restore these settings as a new scene
          </Button>
        </section>
      ) : null}

      {g.prompt ? (
        <section>
          <button type="button" onClick={() => setPromptOpen((o) => !o)} className="flex w-full items-center justify-between" aria-expanded={promptOpen}>
            <MetaLabel>Submitted prompt</MetaLabel>
            <ChevronDown className={cn("size-3 text-text-muted transition-transform", !promptOpen && "-rotate-90")} />
          </button>
          {promptOpen ? (
            <div className="relative mt-2">
              <pre className="max-h-72 overflow-y-auto rounded-md border border-border bg-surface p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-text-secondary">{g.prompt}</pre>
              <button
                type="button"
                aria-label="Copy submitted prompt"
                className="absolute top-1.5 right-1.5 rounded-sm p-1 text-text-muted hover:bg-interactive hover:text-foreground"
                onClick={() => void navigator.clipboard.writeText(g.prompt).then(() => toast.success("Prompt copied"))}
              >
                <Copy className="size-3" />
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {detail?.references.length || g.referenceIds.length ? (
        <section>
          <MetaLabel className="mb-2">References {g.referencesSubmitted ? "submitted" : "selected, not submitted"}</MetaLabel>
          <div className="flex flex-wrap gap-1.5">
            {(detail?.references ?? []).map((r) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={r.id} src={assetSrc(r.assetId)!} alt={r.label} title={`${r.label} · ${r.role}`} className="size-10 rounded-sm object-cover" />
            ))}
            {g.referenceIds.length > (detail?.references.length ?? 0) ? (
              <span className="text-[11px] text-text-muted">{g.referenceIds.length - (detail?.references.length ?? 0)} since deleted</span>
            ) : null}
          </div>
        </section>
      ) : null}

      {lineage.length > 1 ? (
        <section>
          <MetaLabel className="mb-2">Lineage</MetaLabel>
          <div className="flex flex-wrap gap-1.5">
            {lineage.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => select(x.id)}
                title={`${titleCase(x.kind)} · ${formatDateTime(x.createdAt)}`}
                className={cn("relative size-11 overflow-hidden rounded-sm border", x.id === g.id ? "border-foreground" : x.id === g.parentId ? "border-info" : "border-border")}
              >
                {x.assetId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetSrc(x.assetId)!} alt="" className="size-full object-cover" />
                ) : (
                  <span className="block size-full bg-surface" />
                )}
              </button>
            ))}
          </div>
          {detail?.parent ? <p className="mt-1.5 text-[11px] text-text-muted">Blue outline marks the parent image.</p> : null}
        </section>
      ) : null}

      <section className="space-y-2">
        <MetaLabel>Tags</MetaLabel>
        <TagEditor g={g} />
      </section>

      <section className="space-y-2">
        <MetaLabel>Collections</MetaLabel>
        {detail?.collections.length ? (
          <div className="flex flex-wrap gap-1">
            {detail.collections.map((c) => (
              <Link key={c.id} href={`/collections/${c.id}`} className="rounded-sm border border-border px-1.5 py-0.5 text-[11.5px] text-text-secondary hover:text-foreground">
                {c.name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[11.5px] text-text-muted">Not in any collection.</p>
        )}
      </section>

      <section className="space-y-2">
        <MetaLabel>Notes</MetaLabel>
        <Textarea
          value={notes.value}
          onChange={(e) => notes.setValue(e.target.value)}
          onBlur={() => void notes.commit()}
          rows={3}
          placeholder="What works, what to try next"
          className="resize-none text-[12.5px]"
          aria-label="Notes"
        />
      </section>

      <section className="border-t border-border pt-4">
        <Button
          size="xs"
          variant="ghost"
          className="-ml-2 text-danger"
          onClick={async () => {
            if (await deletePermanently(g)) useStudio.getState().select(null);
          }}
        >
          <Trash2 /> Delete permanently
        </Button>
      </section>
    </div>
  );
}
