"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ArrowLeft, Copy, Dna, Loader2, Lock, LockOpen, MoreHorizontal, SearchX } from "lucide-react";
import {
  STYLE_ATTRIBUTE_LABELS,
  type StyleAttributeKey,
  type StyleAttributes,
  type StyleProfile,
  type StyleProfileVersion,
  type StyleSnapshot,
  type ReferenceImage,
  type Swatch,
} from "@/lib/domain/schemas";
import type { PaletteMode } from "@/lib/domain/vocab";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { invalidate, useResource } from "@/lib/client/resource";
import { useApp, usePreferences, useProfiles } from "@/stores/app";
import { cn, formatDate } from "@/lib/utils";
import { confirmAction } from "@/components/common/confirm";
import { EmptyState, MetaLabel, PageHeader } from "@/components/common/primitives";
import { PaletteEditor } from "@/components/palette/palette-editor";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { duplicateProfile, profileKey, setActiveProfile, setArchived, setProfileLocked } from "./actions";
import { ListAttributeField, TextAttributeField } from "./attribute-fields";
import { ReferenceBoard, useReferences, type ReferenceWithAsset } from "./reference-board";
import { VersionDialog, VersionHistory } from "./version-history";

type Detail = { profile: StyleProfile; versions: StyleProfileVersion[]; references: ReferenceImage[]; generationCount: number };
type Draft = { name?: string; description?: string; attributes: Partial<StyleAttributes>; defaultPalette?: Swatch[] };

const EMPTY_DRAFT: Draft = { attributes: {} };

const SECTIONS: { id: string; title: string; description: string; keys: StyleAttributeKey[] }[] = [
  { id: "medium", title: "Medium and rendering", description: "What the work is made of and how it is rendered.", keys: ["medium", "renderingStyle", "photographic"] },
  { id: "exposure", title: "Exposure and tone", description: "How bright, how contrasty, how deep the shadows go.", keys: ["exposure", "contrast", "shadowDepth"] },
  { id: "light", title: "Light and colour", description: "Light sources, colour logic and saturation.", keys: ["lighting", "colorPhilosophy", "saturation"] },
  { id: "texture", title: "Texture and atmosphere", description: "Surface, grain and the feel of the air.", keys: ["texture", "grain", "atmosphericDepth"] },
  {
    id: "composition",
    title: "Composition and subjects",
    description: "How frames are arranged and how subjects and places are treated.",
    keys: ["compositionPhilosophy", "subjectTreatment", "environmentalTreatment"],
  },
  { id: "emotion", title: "Emotion", description: "The feeling every image should carry.", keys: ["emotionalCharacter"] },
  {
    id: "rules",
    title: "Rules",
    description: "Hard requirements and exclusions, applied to every prompt using this profile.",
    keys: ["requiredElements", "prohibitedElements", "positiveInstructions", "negativeConstraints"],
  },
];

const LIST_HINTS: Partial<Record<StyleAttributeKey, { placeholder: string; hint: string; max: number }>> = {
  requiredElements: { placeholder: "Add an element and press Enter", hint: "Elements every image should include.", max: 40 },
  prohibitedElements: { placeholder: "Add an element and press Enter", hint: "Elements the model must avoid.", max: 60 },
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function dirtyCount(d: Draft) {
  return Object.keys(d.attributes).length + (d.name !== undefined ? 1 : 0) + (d.description !== undefined ? 1 : 0) + (d.defaultPalette !== undefined ? 1 : 0);
}

function DetailSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Loading profile">
      <div className="space-y-3 border-b border-border px-8 pt-7 pb-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid flex-1 gap-10 px-8 py-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export function StyleEditor({ id }: { id: string }) {
  const { data, error, loading } = useResource<Detail>(profileKey(id));
  const storeProfile = useProfiles().find((p) => p.id === id);
  const { data: refData } = useReferences(id);

  const fetched = data?.profile;
  const profile = storeProfile && (!fetched || storeProfile.updatedAt >= fetched.updatedAt) ? storeProfile : fetched;

  if (!profile) {
    if (loading || (!error && !data)) return <DetailSkeleton />;
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Looks" meta={<BackLink />} />
        <EmptyState
          icon={SearchX}
          title={error instanceof ApiError && error.status === 404 ? "Profile not found" : "This profile could not be loaded"}
          description={error ? errorMessage(error) : undefined}
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/style-dna">Back to Looks</Link>
            </Button>
          }
          className="flex-1"
        />
      </div>
    );
  }

  return <ProfileEditor key={profile.id} profile={profile} detail={data} references={refData?.references} />;
}

function ProfileEditor({
  profile: p,
  detail: data,
  references,
}: {
  profile: StyleProfile;
  detail: Detail | undefined;
  references: ReferenceWithAsset[] | undefined;
}) {
  const router = useRouter();
  const prefs = usePreferences();
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState(() => {
    const t = searchParams.get("tab");
    return t === "references" || t === "versions" ? t : "attributes";
  });
  const [saving, setSaving] = React.useState(false);
  const [paletteMode, setPaletteMode] = React.useState<PaletteMode>("custom");
  const [viewing, setViewing] = React.useState<StyleProfileVersion | null>(null);

  const dirty = dirtyCount(draft);

  // Warn before leaving the page with unsaved edits.
  React.useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  const onSaveShortcut = React.useEffectEvent(() => void save());
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSaveShortcut();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = prefs?.activeStyleProfileId === p.id;
  const versions = data?.versions ?? [];
  const generationCount = data?.generationCount ?? 0;
  const attrLocked = (k: StyleAttributeKey) => p.lockedAttributes.includes(k);
  // The profile-level banner explains a fully locked profile; per-field notes cover attribute locks.
  const readOnlyReason = (k: StyleAttributeKey) => (!p.locked && attrLocked(k) ? "Locked. Unlock this attribute to edit it." : null);

  const attrValue = <K extends StyleAttributeKey>(k: K): StyleAttributes[K] => (draft.attributes[k] ?? p.attributes[k]) as StyleAttributes[K];

  function setAttr<K extends StyleAttributeKey>(k: K, v: StyleAttributes[K]) {
    setDraft((d) => {
      const attributes = { ...d.attributes };
      if (same(v, p.attributes[k])) delete attributes[k];
      else attributes[k] = v;
      return { ...d, attributes };
    });
  }

  function setMeta(field: "name" | "description", v: string) {
    setDraft((d) => {
      const next = { ...d };
      if (v === p[field]) delete next[field];
      else next[field] = v;
      return next;
    });
  }

  function setPalette(swatches: Swatch[]) {
    setDraft((d) => {
      const next = { ...d };
      if (same(swatches, p.defaultPalette)) delete next.defaultPalette;
      else next.defaultPalette = swatches;
      return next;
    });
  }

  function discard() {
    setDraft(EMPTY_DRAFT);
  }

  async function save() {
    if (!dirty || saving) return;
    if (draft.name !== undefined && !draft.name.trim()) {
      toast.error("The profile needs a name");
      return;
    }
    const body: Record<string, unknown> = {};
    if (draft.name !== undefined) body.name = draft.name.trim();
    if (draft.description !== undefined) body.description = draft.description;
    if (draft.defaultPalette !== undefined) body.defaultPalette = draft.defaultPalette;
    if (Object.keys(draft.attributes).length) body.attributes = draft.attributes;
    setSaving(true);
    try {
      const { profile: next } = await api<{ profile: StyleProfile }>(`/api/styles/${p.id}`, { method: "PATCH", body });
      useApp.getState().upsertProfile(next);
      invalidate(profileKey(p.id));
      setDraft(EMPTY_DRAFT);
      toast.success(`Saved as version ${next.currentVersion}`, { description: next.name });
    } catch (err) {
      if (err instanceof ApiError && err.code === "style_locked") {
        toast.error("Locked attributes cannot be changed", { description: err.message });
        invalidate(profileKey(p.id));
        void useApp.getState().refreshProfiles().catch(() => {});
      } else {
        toast.error("Could not save the profile", { description: errorMessage(err) });
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleAttrLock(k: StyleAttributeKey) {
    const locking = !attrLocked(k);
    if (locking && k in draft.attributes) {
      const ok = await confirmAction({
        title: `Discard your edit to ${STYLE_ATTRIBUTE_LABELS[k]}?`,
        description: "Locking keeps the saved value. Save first if you want to keep this edit.",
        confirmLabel: "Discard and lock",
      });
      if (!ok) return;
      setDraft((d) => {
        const attributes = { ...d.attributes };
        delete attributes[k];
        return { ...d, attributes };
      });
    }
    const lockedAttributes = locking ? [...p.lockedAttributes, k] : p.lockedAttributes.filter((x) => x !== k);
    const { upsertProfile } = useApp.getState();
    upsertProfile({ ...p, lockedAttributes });
    try {
      const { profile: next } = await api<{ profile: StyleProfile }>(`/api/styles/${p.id}/lock`, { method: "POST", body: { lockedAttributes } });
      upsertProfile(next);
      invalidate(profileKey(p.id));
    } catch (err) {
      upsertProfile(p);
      toast.error("Could not change the lock", { description: errorMessage(err) });
    }
  }

  async function toggleProfileLock() {
    if (!p.locked && dirty) {
      const ok = await confirmAction({
        title: "Discard unsaved changes and lock?",
        description: `You have ${dirty} unsaved change${dirty === 1 ? "" : "s"}. Save first to keep them.`,
        confirmLabel: "Discard and lock",
      });
      if (!ok) return;
      discard();
    }
    await setProfileLocked(p, !p.locked);
  }

  function loadVersion(snap: StyleSnapshot) {
    if (p.locked) return;
    const attributes: Partial<StyleAttributes> = {};
    let skipped = 0;
    for (const [k, v] of Object.entries(snap.attributes) as [StyleAttributeKey, StyleAttributes[StyleAttributeKey]][]) {
      if (same(v, p.attributes[k])) continue;
      if (attrLocked(k)) {
        skipped++;
        continue;
      }
      (attributes as Record<string, unknown>)[k] = v;
    }
    const next: Draft = { attributes };
    if (snap.name !== p.name) next.name = snap.name;
    if (snap.description !== p.description) next.description = snap.description;
    if (!same(snap.defaultPalette, p.defaultPalette)) next.defaultPalette = snap.defaultPalette;
    setDraft(next);
    setViewing(null);
    setTab("attributes");
    toast.message("Version loaded into the editor", {
      description: `Review the edits and save to create a new version.${skipped ? ` ${skipped} locked attribute${skipped === 1 ? " was" : "s were"} left unchanged.` : ""}`,
    });
  }

  const nameValue = draft.name ?? p.name;
  const descValue = draft.description ?? p.description;
  const paletteSwatches = draft.defaultPalette ?? p.defaultPalette;
  const paletteRefs = (references ?? [])
    .filter((r) => r.asset?.dominantColors.length)
    .map((r) => ({ id: r.id, label: r.label || "Reference", hexes: r.asset!.dominantColors }));
  const refCount = references?.length ?? data?.references.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        meta={<BackLink />}
        title={
          <span className="flex items-center gap-3">
            <span className="truncate">{p.name}</span>
            <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[11px] font-normal text-text-secondary">v{p.currentVersion}</span>
            {p.locked ? (
              <span className="inline-flex items-center gap-1 text-[11.5px] font-normal text-warning">
                <Lock className="size-3" /> Locked
              </span>
            ) : null}
            {p.archived ? <span className="text-[11.5px] font-normal text-text-muted">Archived</span> : null}
          </span>
        }
        description={p.description || undefined}
        actions={
          <>
            {isActive ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] text-text-secondary">
                <span className="size-1.5 rounded-full bg-success" aria-hidden /> Active
              </span>
            ) : (
              <Button size="sm" variant="secondary" disabled={p.archived} onClick={() => void setActiveProfile(p)}>
                <Dna /> Set active
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const copy = await duplicateProfile(p);
                if (copy) router.push(`/style-dna/${copy.id}`);
              }}
            >
              <Copy /> Duplicate
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void toggleProfileLock()} className={cn(p.locked && "text-warning")}>
              {p.locked ? <LockOpen /> : <Lock />}
              {p.locked ? "Unlock profile" : "Lock profile"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More profile actions" className="text-text-muted">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {p.archived ? (
                  <DropdownMenuItem onSelect={() => void setArchived(p, false)}>
                    <ArchiveRestore /> Unarchive
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled={isActive} onSelect={() => void setArchived(p, true)}>
                    <Archive /> Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
        <div className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-border px-8">
          <TabsList variant="line" className="h-11 gap-4 p-0">
            <TabsTrigger value="attributes" className="h-11 flex-none px-0 text-[12.5px] font-normal">
              Attributes
            </TabsTrigger>
            <TabsTrigger value="references" className="h-11 flex-none px-0 text-[12.5px] font-normal">
              References <span className="font-mono text-[11px] text-text-muted">{refCount}</span>
            </TabsTrigger>
            <TabsTrigger value="versions" className="h-11 flex-none px-0 text-[12.5px] font-normal">
              Versions <span className="font-mono text-[11px] text-text-muted">{versions.length || p.currentVersion}</span>
            </TabsTrigger>
          </TabsList>
          {dirty ? (
            <div className="flex items-center gap-2" role="status">
              <span className="text-[12px] text-info">
                {dirty} unsaved change{dirty === 1 ? "" : "s"}
              </span>
              <Button size="xs" variant="ghost" onClick={discard} disabled={saving}>
                Discard
              </Button>
              <Button size="xs" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                Save as v{p.currentVersion + 1}
                <Kbd className="ml-0.5 h-4 bg-black/10 text-[10px] text-primary-foreground/70">⌘S</Kbd>
              </Button>
            </div>
          ) : (
            <span className="text-[12px] text-text-muted">
              Used by {generationCount} generation{generationCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <TabsContent value="attributes" data-scroll-root className="min-h-0 overflow-y-auto">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-8 py-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-12">
              {p.locked ? (
                <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  <div className="text-[12.5px] leading-relaxed">
                    <div className="text-foreground">This profile is locked.</div>
                    <div className="text-text-secondary">
                      Its attributes, palette and references are read-only so every image keeps the same identity. Unlock the profile to make changes.
                    </div>
                  </div>
                  <Button size="xs" variant="secondary" className="ml-auto shrink-0" onClick={() => void toggleProfileLock()}>
                    <LockOpen /> Unlock
                  </Button>
                </div>
              ) : null}

              <section id="identity" className="scroll-mt-6 space-y-5">
                <div>
                  <h2 className="text-[13px] font-medium text-foreground">Identity</h2>
                  <p className="mt-0.5 text-[12px] text-text-muted">How this profile is named and described.</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex h-5 items-center justify-between">
                    <label htmlFor="style-name" className="text-[12px] text-text-secondary">
                      Name
                    </label>
                    {draft.name !== undefined ? <span className="text-[10.5px] font-medium text-info">Edited</span> : null}
                  </div>
                  <Input
                    id="style-name"
                    value={nameValue}
                    readOnly={p.locked}
                    maxLength={80}
                    onChange={(e) => setMeta("name", e.target.value)}
                    className={cn("h-9 text-[13px] md:text-[13px]", p.locked && "border-dashed bg-transparent text-text-secondary dark:bg-transparent")}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex h-5 items-center justify-between">
                    <label htmlFor="style-description" className="text-[12px] text-text-secondary">
                      Description
                    </label>
                    {draft.description !== undefined ? <span className="text-[10.5px] font-medium text-info">Edited</span> : null}
                  </div>
                  <Textarea
                    id="style-description"
                    value={descValue}
                    readOnly={p.locked}
                    maxLength={1000}
                    placeholder="What this visual identity is for."
                    onChange={(e) => setMeta("description", e.target.value)}
                    className={cn(
                      "min-h-[38px] resize-none px-3 py-2 text-[13px] leading-relaxed md:text-[13px]",
                      p.locked && "border-dashed bg-transparent text-text-secondary dark:bg-transparent",
                    )}
                  />
                </div>
              </section>

              {SECTIONS.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-6 space-y-5">
                  <div>
                    <h2 className="text-[13px] font-medium text-foreground">{s.title}</h2>
                    <p className="mt-0.5 text-[12px] text-text-muted">{s.description}</p>
                  </div>
                  {s.keys.map((k) => {
                    const list = LIST_HINTS[k];
                    const common = {
                      attr: k,
                      locked: attrLocked(k),
                      lockDisabled: p.locked,
                      onToggleLock: () => void toggleAttrLock(k),
                      edited: k in draft.attributes,
                      readOnly: p.locked || attrLocked(k),
                      readOnlyReason: readOnlyReason(k),
                    };
                    return list ? (
                      <ListAttributeField
                        key={k}
                        {...common}
                        values={attrValue(k) as string[]}
                        onChange={(v) => setAttr(k, v as StyleAttributes[typeof k])}
                        placeholder={list.placeholder}
                        hint={list.hint}
                        max={list.max}
                      />
                    ) : (
                      <TextAttributeField
                        key={k}
                        {...common}
                        value={attrValue(k) as string}
                        onChange={(v) => setAttr(k, v as StyleAttributes[typeof k])}
                        placeholder={`Describe the ${STYLE_ATTRIBUTE_LABELS[k].toLowerCase()}.`}
                      />
                    );
                  })}
                </section>
              ))}
            </div>

            <aside className="space-y-8 self-start xl:sticky xl:top-8">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <MetaLabel>Default palette</MetaLabel>
                  {draft.defaultPalette !== undefined ? <span className="text-[10.5px] font-medium text-info">Edited</span> : null}
                </div>
                <PaletteEditor
                  value={{ mode: paletteMode, swatches: paletteSwatches, saturation: 0, warmth: 0, contrast: 0 }}
                  onChange={(next) => {
                    setPaletteMode(next.mode);
                    setPalette(next.swatches);
                  }}
                  sceneText={descValue}
                  references={paletteRefs}
                  disabled={p.locked}
                  showModes
                  showAdjustments={false}
                />
                <p className="text-[11.5px] text-text-muted">New scenes using this profile start from this palette. Saved with the profile.</p>
              </section>

              <section className="space-y-3">
                <MetaLabel>Summary</MetaLabel>
                <dl className="divide-y divide-border rounded-lg border border-border text-[12px]">
                  {(
                    [
                      ["Version", `v${p.currentVersion}`],
                      ["Used by", `${generationCount} generation${generationCount === 1 ? "" : "s"}`],
                      ["Locks", p.locked ? "Whole profile" : p.lockedAttributes.length ? `${p.lockedAttributes.length} attribute${p.lockedAttributes.length === 1 ? "" : "s"}` : "None"],
                      ["References", `${refCount}`],
                      ["Updated", formatDate(p.updatedAt)],
                      ["Created", formatDate(p.createdAt)],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-3 py-2">
                      <dt className="text-text-muted">{k}</dt>
                      <dd className="text-text-secondary">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <nav aria-label="Sections" className="space-y-2">
                <MetaLabel>On this page</MetaLabel>
                <ul className="space-y-0.5">
                  {[{ id: "identity", title: "Identity", keys: [] as StyleAttributeKey[] }, ...SECTIONS].map((s) => {
                    const edits = s.keys.filter((k) => k in draft.attributes).length + (s.id === "identity" ? (draft.name !== undefined ? 1 : 0) + (draft.description !== undefined ? 1 : 0) : 0);
                    const locks = s.keys.filter(attrLocked).length;
                    return (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            const el = document.getElementById(s.id);
                            const root = el?.closest<HTMLElement>("[data-scroll-root]");
                            if (el && root) root.scrollTo({ top: el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 24, behavior: "smooth" });
                          }}
                          className="flex h-7 items-center justify-between rounded-md px-2 text-[12px] text-text-secondary hover:bg-surface hover:text-foreground"
                        >
                          {s.title}
                          <span className="flex items-center gap-2 text-[11px]">
                            {edits ? <span className="text-info">{edits} edited</span> : null}
                            {locks ? (
                              <span className="inline-flex items-center gap-0.5 text-warning/80">
                                <Lock className="size-2.5" />
                                {locks}
                              </span>
                            ) : null}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="references" className="min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-[1280px] px-8 py-8">
            <ReferenceBoard profileId={p.id} readOnly={p.locked} />
          </div>
        </TabsContent>

        <TabsContent value="versions" className="min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-8 py-8">
            <VersionHistory versions={versions} profile={p} onView={setViewing} />
          </div>
        </TabsContent>
      </Tabs>

      <VersionDialog version={viewing} profile={p} onClose={() => setViewing(null)} onLoad={loadVersion} canLoad={!p.locked} />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/style-dna" className="label-meta inline-flex items-center gap-1 rounded-sm hover:text-text-secondary">
      <ArrowLeft className="size-3" /> Looks
    </Link>
  );
}
