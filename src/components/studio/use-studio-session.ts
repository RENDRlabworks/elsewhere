"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  compositionSchema,
  outputSchema,
  type Concept,
  type ConceptVariable,
  type Generation,
  type PromptTemplate,
  type Scene,
  type SceneContent,
  type SceneField,
} from "@/lib/domain/schemas";
import { ANCHOR_POINTS, type Anchor, type CameraAngle, type CompositionPreset } from "@/lib/domain/vocab";
import { conceptToScene, sceneToConcept } from "@/lib/explore/engine";
import { assemblePrompt } from "@/lib/prompt/assemble";
import { api, ApiError, errorMessage, newIdempotencyKey } from "@/lib/client/api";
import { invalidate, useResource } from "@/lib/client/resource";
import { confirmAction } from "@/components/common/confirm";
import { isActive } from "@/components/generation/actions";
import { useApp, useProfiles, useProviders } from "@/stores/app";
import { onCommand, useUi } from "@/stores/ui";
import { useStudio } from "@/stores/studio";

const FIELD_TO_VARIABLES: Partial<Record<SceneField, ConceptVariable[]>> = {
  subject: ["character", "action"],
  environment: ["environment"],
  naturalElement: ["naturalElement"],
  materials: ["material"],
  phenomenon: ["phenomenon"],
  composition: ["composition", "scale"],
  emotionalTone: ["emotionalTone"],
  lighting: ["lighting"],
  palette: ["palette"],
  atmosphere: ["atmosphere"],
};

export type ScenePlan = {
  provider: string;
  model: { id: string; label: string; unverified: boolean };
  width: number;
  height: number;
  quality: string;
  format: string;
  n: number;
  referencesSubmitted: boolean;
  referenceCount: number;
  estimate: { usd: number | null; basis: string };
  notes: string[];
};

/** Merge a concept into the scene, touching only fields that are not locked. */
export function applyConceptToScene(scene: SceneContent, concept: Concept): Partial<SceneContent> {
  const c = conceptToScene(concept);
  const locked = new Set(scene.lockedFields);
  const out: Partial<SceneContent> = {};
  if (!locked.has("title")) out.title = c.title;
  if (!locked.has("description")) out.description = c.description;
  if (!locked.has("subject") && c.subject) out.subject = { ...scene.subject, ...c.subject, clothing: scene.subject.clothing, count: 1 };
  if (!locked.has("environment")) out.environment = c.environment;
  if (!locked.has("naturalElement")) out.naturalElement = c.naturalElement;
  if (!locked.has("phenomenon")) out.phenomenon = c.phenomenon;
  if (!locked.has("emotionalTone")) out.emotionalTone = c.emotionalTone;
  if (!locked.has("atmosphere")) out.atmosphere = c.atmosphere;
  if (!locked.has("timeOfDay")) out.timeOfDay = c.timeOfDay;
  if (!locked.has("materials")) out.materials = c.materials;
  if (!locked.has("lighting")) out.lighting = c.lighting;
  if (!locked.has("composition") && c.composition) out.composition = { ...scene.composition, ...c.composition };
  if (!locked.has("palette") && c.palette) out.palette = { ...scene.palette, mode: "material", swatches: c.palette.swatches };
  return out;
}

export function useStudioSession() {
  const router = useRouter();
  const params = useSearchParams();
  const prefs = useApp((s) => s.data?.preferences);
  const updatePreferences = useApp((s) => s.updatePreferences);
  const profiles = useProfiles();
  const providers = useProviders();
  const studio = useStudio();
  const [booting, setBooting] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [randomizing, setRandomizing] = React.useState(false);
  const [extra, setExtra] = React.useState<Generation | null>(null);
  const handledParams = React.useRef<string | null>(null);
  const savingRef = React.useRef<Promise<string | null> | null>(null);

  /* ------------------------------------------------------------------ */
  /* Initial load from URL params or where the user left off            */
  /* ------------------------------------------------------------------ */

  const defaultsForNew = React.useCallback((): Partial<SceneContent> => {
    const d = prefs?.defaults;
    return {
      styleProfileId: prefs?.activeStyleProfileId ?? d?.styleProfileId ?? null,
      output: outputSchema.parse({
        provider: d?.provider ?? "openai",
        model: d?.model ?? null,
        aspectRatio: d?.aspectRatio,
        longEdge: d?.longEdge,
        quality: d?.quality,
        format: d?.format,
      }),
    };
  }, [prefs]);

  const applySuggestion = React.useCallback((s: string) => {
    const [kind, key] = s.split(":");
    const st = useStudio.getState();
    if (kind === "composition") st.update((sc) => ({ composition: { ...sc.composition, preset: key as CompositionPreset } }));
    else if (kind === "anchor" && key in ANCHOR_POINTS) {
      const [x, y] = ANCHOR_POINTS[key as Exclude<Anchor, "custom">];
      st.update((sc) => ({ composition: { ...sc.composition, anchor: key as Anchor, x, y } }));
    } else if (kind === "angle") st.update((sc) => ({ composition: { ...sc.composition, cameraAngle: key as CameraAngle } }));
    toast.success("Applied an underused composition suggestion");
  }, []);

  /** Page commands, filled in after render so they always see current state. */
  const commands = React.useRef<Record<string, () => void>>({});
  const runCommandLocal = React.useCallback((name: string) => commands.current[name]?.(), []);

  React.useEffect(() => {
    if (!prefs) return;
    const key = params.toString();
    if (handledParams.current === key) return;
    handledParams.current = key;
    const sceneParam = params.get("scene");
    const genParam = params.get("generation");
    const restoreParam = params.get("restore");
    const suggest = params.get("suggest");
    const command = params.get("command");

    (async () => {
      try {
        if (restoreParam) {
          const { generation } = await api<{ generation: Generation }>(`/api/generations/${restoreParam}`);
          if (!generation.sceneSnapshot) throw new Error("This image has no scene settings to restore.");
          useStudio.getState().resetScene({ ...generation.sceneSnapshot, promptOverride: generation.sceneSnapshot.promptOverride });
          toast.success(`Restored the settings used for "${generation.title}"`, { description: "Saved as a new draft scene." });
        } else if (genParam) {
          const { generation } = await api<{ generation: Generation }>(`/api/generations/${genParam}`);
          let loaded = false;
          if (generation.sceneId) {
            const res = await api<{ scene: Scene }>(`/api/scenes/${generation.sceneId}`).catch(() => null);
            if (res && !res.scene.archived) {
              useStudio.getState().loadScene(res.scene);
              loaded = true;
            }
          }
          if (!loaded) {
            useStudio.getState().resetScene({ ...defaultsForNew(), ...(generation.sceneSnapshot ?? { title: generation.title }) });
            setExtra(generation);
          }
          useStudio.getState().select(generation.id);
        } else if (sceneParam) {
          const { scene } = await api<{ scene: Scene }>(`/api/scenes/${sceneParam}`);
          useStudio.getState().loadScene(scene);
        } else if (!useStudio.getState().sceneId && useStudio.getState().saveState === "idle") {
          const last = prefs.lastSceneId ? await api<{ scene: Scene }>(`/api/scenes/${prefs.lastSceneId}`).catch(() => null) : null;
          if (last && !last.scene.archived) useStudio.getState().loadScene(last.scene);
          else {
            const { scenes } = await api<{ scenes: Scene[] }>("/api/scenes?status=draft");
            if (scenes[0]) useStudio.getState().loadScene(scenes[0]);
            else useStudio.getState().resetScene({ ...defaultsForNew(), title: "Untitled scene" });
          }
        }
        if (suggest) applySuggestion(suggest);
        if (command) setTimeout(() => runCommandLocal(command), 50);
      } catch (err) {
        toast.error(errorMessage(err));
        if (!useStudio.getState().sceneId) useStudio.getState().resetScene(defaultsForNew());
      } finally {
        setBooting(false);
        if (sceneParam || genParam || restoreParam || suggest || command) router.replace("/studio", { scroll: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, prefs?.lastSceneId, !!prefs]);

  /* ------------------------------------------------------------------ */
  /* Autosave                                                            */
  /* ------------------------------------------------------------------ */

  const lastSceneId = prefs?.lastSceneId;
  const save = React.useCallback(async (): Promise<string | null> => {
    if (savingRef.current) await savingRef.current;
    const st = useStudio.getState();
    if (st.saveState !== "dirty" && st.saveState !== "error" && st.sceneId) return st.sceneId;
    const revisionAtSave = st.revision;
    st.markSaving();
    const p = (async () => {
      try {
        let saved: Scene;
        let forked = false;
        if (st.sceneId) {
          const res = await api<{ scene: Scene; forked?: boolean }>(`/api/scenes/${st.sceneId}`, { method: "PATCH", body: st.scene });
          saved = res.scene;
          forked = !!res.forked;
        } else {
          saved = (await api<{ scene: Scene }>("/api/scenes", { method: "POST", body: { ...st.scene, status: "draft", origin: "studio" } })).scene;
        }
        useStudio.getState().markSaved(saved, revisionAtSave);
        if (forked) toast("Editing a working copy", { description: "The original Volume I scene record is preserved." });
        if (saved.id !== lastSceneId) void updatePreferences({ lastSceneId: saved.id }).catch(() => {});
        invalidate("/api/scenes");
        return saved.id;
      } catch (err) {
        useStudio.getState().markSaveError(errorMessage(err));
        return null;
      } finally {
        savingRef.current = null;
      }
    })();
    savingRef.current = p;
    return p;
  }, [lastSceneId, updatePreferences]);

  const autosave = prefs?.autosave;
  React.useEffect(() => {
    if (booting || studio.saveState !== "dirty" || !autosave?.enabled) return;
    const t = setTimeout(() => void save(), autosave.delayMs);
    return () => clearTimeout(t);
  }, [studio.revision, studio.saveState, booting, autosave?.enabled, autosave?.delayMs, save]);

  // Flush unsaved edits before leaving the page.
  React.useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      const s = useStudio.getState().saveState;
      if (s === "dirty" || s === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => {
      window.removeEventListener("beforeunload", onBefore);
      if (useStudio.getState().saveState === "dirty") void save();
    };
  }, [save]);

  /* ------------------------------------------------------------------ */
  /* Generations for this scene, with polling while jobs are active      */
  /* ------------------------------------------------------------------ */

  const listKey = studio.sceneId ? `/api/generations?sceneId=${studio.sceneId}&limit=100` : null;
  const { data: list, reload } = useResource<{ items: Generation[]; total: number }>(listKey);
  const generations = React.useMemo(() => {
    const items = list?.items ?? [];
    return extra && !items.some((g) => g.id === extra.id) ? [extra, ...items] : items;
  }, [list, extra]);
  const anyActive = generations.some((g) => isActive(g.status));
  React.useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => void reload(), 1500);
    return () => clearInterval(t);
  }, [anyActive, reload]);

  // Keep a valid selection.
  React.useEffect(() => {
    if (!generations.length) return;
    if (!studio.selectedId || !generations.some((g) => g.id === studio.selectedId)) {
      useStudio.getState().select(generations[0].id);
    }
  }, [generations, studio.selectedId]);

  const selected = generations.find((g) => g.id === studio.selectedId) ?? null;

  /* ------------------------------------------------------------------ */
  /* Prompt preview (deterministic, same engine as the server)           */
  /* ------------------------------------------------------------------ */

  const profile = profiles.find((p) => p.id === studio.scene.styleProfileId) ?? null;
  const { data: templates } = useResource<{ templates: PromptTemplate[] }>("/api/prompt-templates");
  const { data: refData } = useResource<{ references: { id: string; assetId: string; role: string; label: string; enabled: boolean; profileId: string | null; asset: { dominantColors: string[]; width: number; height: number } | null }[] }>(
    "/api/references",
  );
  const provider = providers.find((p) => p.id === studio.scene.output.provider && p.configured) ?? providers.find((p) => p.configured) ?? null;
  const model = provider?.models.find((m) => m.id === (studio.scene.output.model ?? provider.defaultModel)) ?? provider?.models[0] ?? null;
  const supportsRefs = !!model?.capabilities.referenceImages;
  const sceneRefs = (refData?.references ?? []).filter((r) => studio.scene.referenceIds.includes(r.id));
  const template = templates?.templates.find((t) => t.id === studio.scene.promptTemplateId)?.body ?? null;

  const prompt = React.useMemo(
    () =>
      assemblePrompt({
        scene: studio.scene,
        style: profile ? { name: profile.name, description: profile.description, attributes: profile.attributes, defaultPalette: profile.defaultPalette } : null,
        lockedStyleKeys: profile?.lockedAttributes,
        styleLocked: profile?.locked,
        references: supportsRefs
          ? sceneRefs.slice(0, model?.capabilities.maxReferenceImages ?? 0).map((r) => ({ role: r.role as never, label: r.label }))
          : [],
        template,
      }),
    [studio.scene, profile, supportsRefs, sceneRefs, model, template],
  );

  /* ------------------------------------------------------------------ */
  /* Generation actions                                                  */
  /* ------------------------------------------------------------------ */

  const generatingRef = React.useRef(false);
  const generate = React.useCallback(
    async (opts: { operation?: "generate" | "variation" | "refine"; parentId?: string | null; instruction?: string; countOverride?: number } = {}) => {
      if (generatingRef.current) return;
      generatingRef.current = true;
      setGenerating(true);
      const idempotencyKey = newIdempotencyKey();
      const operation = opts.operation ?? "generate";
      try {
        const sceneId = await save();
        if (!sceneId) throw new Error("The scene could not be saved, so nothing was generated.");
        const scene = useStudio.getState().scene;
        const body = {
          idempotencyKey,
          sceneId,
          scene: opts.countOverride ? { ...scene, output: { ...scene.output, count: opts.countOverride } } : scene,
          operation,
          parentGenerationId: opts.parentId ?? null,
          instruction: opts.instruction ?? "",
          useReferences: true,
          confirmedCost: false,
        };
        const submit = async (confirmed: boolean) =>
          api<{ job: { id: string }; generations: Generation[]; notes: string[] }>("/api/generations", { body: { ...body, confirmedCost: confirmed } });
        let res;
        try {
          res = await submit(false);
        } catch (err) {
          if (err instanceof ApiError && err.code === "confirm_cost") {
            const d = err.details as { estimateUsd: number; basis: string };
            const ok = await confirmAction({
              title: `Generate for about $${d.estimateUsd.toFixed(2)}?`,
              description:
                d.basis === "recent-average"
                  ? "Estimated from your recent generations with this model. This is above your confirmation threshold."
                  : "Estimated from the provider's published pricing. This is above your confirmation threshold.",
              confirmLabel: "Generate",
            });
            if (!ok) return;
            res = await submit(true);
          } else throw err;
        }
        setExtra(null);
        if (res.generations[0]) useStudio.getState().select(res.generations[0].id);
        void reload();
        invalidate("/api/generations?", "/api/insights");
        // Capability notes are already shown in the Output panel; only surface the unexpected ones.
        for (const n of res.notes) if (!/development sketch|not configured/i.test(n)) toast(n);
      } catch (err) {
        if (err instanceof ApiError && ["daily_limit", "budget_exceeded"].includes(err.code)) {
          toast.error(err.message, { action: { label: "Settings", onClick: () => router.push("/settings#limits") } });
        } else if (err instanceof ApiError && err.code === "no_provider") {
          toast.error(err.message, { action: { label: "Set up", onClick: () => router.push("/settings#integrations") } });
        } else toast.error(errorMessage(err));
      } finally {
        generatingRef.current = false;
        setGenerating(false);
      }
    },
    [save, reload, router],
  );

  const cancel = React.useCallback(
    async (g: Generation) => {
      if (!g.jobId) return;
      try {
        await api(`/api/jobs/${g.jobId}/cancel`, { method: "POST" });
        void reload();
        toast("Generation cancelled");
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    [reload],
  );

  const retry = React.useCallback(
    async (g: Generation) => {
      if (!g.jobId) return;
      try {
        const res = await api<{ generations: Generation[] }>(`/api/jobs/${g.jobId}/retry`, { body: { idempotencyKey: newIdempotencyKey() } });
        if (res.generations[0]) useStudio.getState().select(res.generations[0].id);
        void reload();
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    [reload],
  );

  const randomize = React.useCallback(async () => {
    if (randomizing) return;
    setRandomizing(true);
    try {
      const st = useStudio.getState();
      const base = sceneToConcept(st.scene);
      const locked: Partial<Record<ConceptVariable, true>> = {};
      for (const f of st.scene.lockedFields) for (const v of FIELD_TO_VARIABLES[f] ?? []) locked[v] = true;
      const res = await api<{ concepts: Concept[] }>("/api/concepts", {
        body: { mode: base && Object.keys(locked).length ? "randomize-unlocked" : "randomize-all", base, locked, useAi: false, count: 1 },
      });
      const c = res.concepts[0];
      if (c) {
        st.update(applyConceptToScene(st.scene, c));
        toast(`New direction: ${c.title}`, { action: { label: "Undo", onClick: () => useStudio.getState().undo() } });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRandomizing(false);
    }
  }, [randomizing]);

  const newScene = React.useCallback(async () => {
    if (useStudio.getState().saveState === "dirty") await save();
    useStudio.getState().resetScene({ ...defaultsForNew(), title: "Untitled scene", composition: compositionSchema.parse({}) });
    setExtra(null);
    toast("New scene");
  }, [save, defaultsForNew]);

  const copyPrompt = React.useCallback(async () => {
    await navigator.clipboard.writeText(prompt.text);
    toast.success("Prompt copied");
  }, [prompt.text]);

  /* ------------------------------------------------------------------ */
  /* Commands from the palette                                           */
  /* ------------------------------------------------------------------ */

  React.useEffect(() => {
    commands.current = {
    generate: () => void generate(),
    randomize: () => void randomize(),
    "new-scene": () => void newScene(),
    "copy-prompt": () => void copyPrompt(),
    "toggle-fullscreen": () => useUi.getState().setFullscreen(!useUi.getState().fullscreen),
    "toggle-inspector": () => useUi.getState().toggleInspector(),
    "style-changed": () => {
      const active = useApp.getState().data?.preferences.activeStyleProfileId;
      if (active) useStudio.getState().update({ styleProfileId: active });
    },
    };
  });
  React.useEffect(() => {
    const offs = Object.keys(commands.current).map((name) => onCommand(name, () => commands.current[name]?.()));
    return () => offs.forEach((o) => o());
  }, []);

  return {
    booting,
    generating,
    randomizing,
    generations,
    selected,
    reload,
    save,
    generate,
    cancel,
    retry,
    randomize,
    newScene,
    copyPrompt,
    prompt,
    profile,
    provider,
    model,
    references: refData?.references ?? [],
    templates: templates?.templates ?? [],
  };
}

export type StudioSession = ReturnType<typeof useStudioSession>;

/** Server-side plan preview (dimensions, notes, cost), debounced. */
export function usePlanPreview(scene: SceneContent, sceneId: string | null) {
  const [plan, setPlan] = React.useState<ScenePlan | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const key = JSON.stringify({ o: scene.output, r: scene.referenceIds, s: scene.styleProfileId });
  React.useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await api<ScenePlan>("/api/generations/plan", {
          body: { idempotencyKey: "plan-preview", sceneId, scene, operation: "generate", useReferences: true },
          signal: ctrl.signal,
        });
        setPlan(res);
        setError(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sceneId]);
  return { plan, error };
}
