"use client";

import { create } from "zustand";
import { sceneContentSchema, type Scene, type SceneContent, type SceneField } from "@/lib/domain/schemas";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const HISTORY_LIMIT = 80;

type StudioState = {
  sceneId: string | null;
  sceneStatus: Scene["status"] | null;
  seriesIndex: number | null;
  scene: SceneContent;
  saveState: SaveState;
  saveError: string | null;
  lastSavedAt: number | null;
  /** Monotonic counter so autosave can tell whether edits happened during a save. */
  revision: number;
  past: SceneContent[];
  future: SceneContent[];
  selectedId: string | null;
  compareId: string | null;
  compareMode: "off" | "slider" | "side";
  /** Create shows its start screen instead of a scene. Loading or starting a scene closes it. */
  startOpen: boolean;

  setStartOpen: (open: boolean) => void;
  loadScene: (scene: Scene) => void;
  resetScene: (content?: Partial<SceneContent>) => void;
  update: (patch: Partial<SceneContent> | ((s: SceneContent) => Partial<SceneContent>), opts?: { history?: boolean }) => void;
  toggleLockedField: (f: SceneField) => void;
  undo: () => void;
  redo: () => void;
  markSaving: () => void;
  markSaved: (scene: Scene, revisionAtSave: number) => void;
  markSaveError: (msg: string) => void;
  select: (id: string | null) => void;
  setCompare: (id: string | null, mode?: StudioState["compareMode"]) => void;
};

const blank = () => sceneContentSchema.parse({});

/** Strip server metadata from a scene row. */
export function contentOf(scene: Scene): SceneContent {
  const { id: _a, userId: _b, createdAt: _c, updatedAt: _d, status: _e, origin: _f, seriesIndex: _g, archived: _h, ...content } = scene;
  void _a; void _b; void _c; void _d; void _e; void _f; void _g; void _h;
  return sceneContentSchema.parse(content);
}

export const useStudio = create<StudioState>((set, get) => ({
  sceneId: null,
  sceneStatus: null,
  seriesIndex: null,
  scene: blank(),
  saveState: "idle",
  saveError: null,
  lastSavedAt: null,
  revision: 0,
  past: [],
  future: [],
  selectedId: null,
  compareId: null,
  compareMode: "off",
  startOpen: false,

  setStartOpen: (open) => set({ startOpen: open }),

  loadScene(scene) {
    set({
      sceneId: scene.id,
      sceneStatus: scene.status,
      seriesIndex: scene.seriesIndex,
      scene: contentOf(scene),
      saveState: "saved",
      saveError: null,
      lastSavedAt: Date.parse(scene.updatedAt) || Date.now(),
      past: [],
      future: [],
      selectedId: null,
      compareId: null,
      compareMode: "off",
      startOpen: false,
    });
  },

  resetScene(content) {
    set({
      sceneId: null,
      sceneStatus: null,
      seriesIndex: null,
      scene: sceneContentSchema.parse(content ?? {}),
      saveState: "dirty",
      saveError: null,
      past: [],
      future: [],
      selectedId: null,
      compareId: null,
      compareMode: "off",
      startOpen: false,
      revision: get().revision + 1,
    });
  },

  update(patch, opts = {}) {
    const cur = get().scene;
    const p = typeof patch === "function" ? patch(cur) : patch;
    const next = { ...cur, ...p };
    set((s) => ({
      scene: next,
      saveState: "dirty",
      revision: s.revision + 1,
      past: opts.history === false ? s.past : [...s.past, cur].slice(-HISTORY_LIMIT),
      future: opts.history === false ? s.future : [],
    }));
  },

  toggleLockedField(f) {
    get().update((s) => ({ lockedFields: s.lockedFields.includes(f) ? s.lockedFields.filter((x) => x !== f) : [...s.lockedFields, f] }));
  },

  undo() {
    const { past, scene, future } = get();
    if (!past.length) return;
    set((s) => ({
      scene: past[past.length - 1],
      past: past.slice(0, -1),
      future: [scene, ...future].slice(0, HISTORY_LIMIT),
      saveState: "dirty",
      revision: s.revision + 1,
    }));
  },

  redo() {
    const { past, scene, future } = get();
    if (!future.length) return;
    set((s) => ({
      scene: future[0],
      future: future.slice(1),
      past: [...past, scene].slice(-HISTORY_LIMIT),
      saveState: "dirty",
      revision: s.revision + 1,
    }));
  },

  markSaving: () => set({ saveState: "saving", saveError: null }),
  markSaved(scene, revisionAtSave) {
    set((s) => ({
      sceneId: scene.id,
      sceneStatus: scene.status,
      seriesIndex: scene.seriesIndex,
      saveState: s.revision === revisionAtSave ? "saved" : "dirty",
      lastSavedAt: Date.now(),
    }));
  },
  markSaveError: (msg) => set({ saveState: "error", saveError: msg }),

  select: (id) => set({ selectedId: id }),
  setCompare: (id, mode) => set((s) => ({ compareId: id, compareMode: mode ?? (id ? (s.compareMode === "off" ? "slider" : s.compareMode) : "off") })),
}));
