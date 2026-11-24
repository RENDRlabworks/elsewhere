"use client";

import { create } from "zustand";
import { toast } from "sonner";
import type { Concept, ConceptVariable } from "@/lib/domain/schemas";
import type { ConceptMode } from "@/lib/explore/engine";
import { api, ApiError, errorMessage } from "@/lib/client/api";

export type ConceptSource = { kind: "engine" } | { kind: "ai"; model?: string } | { kind: "saved"; sceneId: string };

export type ConceptEntry = {
  id: string;
  concept: Concept;
  source: ConceptSource;
  at: number;
};

type ConceptResponse = { concepts: Concept[]; source: "engine" | "ai"; model?: string };

const HISTORY_LIMIT = 12;

/** Modes that respect locks and build on the current concept. */
export const MODES_WITH_BASE: ConceptMode[] = ["randomize-unlocked", "batch", "similar", "new-direction"];

type ExploreState = {
  current: ConceptEntry | null;
  history: ConceptEntry[];
  batch: ConceptEntry[] | null;
  locked: Partial<Record<ConceptVariable, true>>;
  useAi: boolean;
  /** undefined follows the active Style DNA; null means none. */
  styleProfileId: string | null | undefined;
  pending: ConceptMode | null;
  /** Concept entry id to saved scene id, so a concept is not saved twice. */
  saved: Record<string, string>;
  setCurrent: (entry: ConceptEntry) => void;
  toggleLock: (v: ConceptVariable) => void;
  clearLocks: () => void;
  setUseAi: (v: boolean) => void;
  setStyleProfileId: (id: string | null | undefined) => void;
  dismissBatch: () => void;
  markSaved: (entryId: string, sceneId: string) => void;
  forgetSaved: (sceneId: string) => void;
  run: (mode: ConceptMode, opts: { styleProfileId: string | null }) => Promise<void>;
};

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function makeEntry(concept: Concept, source: ConceptSource): ConceptEntry {
  return { id: newId(), concept, source, at: Date.now() };
}

/** Session-scoped Explore state. Survives navigation within the session, not reloads. */
export const useExplore = create<ExploreState>((set, get) => ({
  current: null,
  history: [],
  batch: null,
  locked: {},
  useAi: false,
  styleProfileId: undefined,
  pending: null,
  saved: {},

  setCurrent(entry) {
    set((s) =>
      s.history.some((h) => h.id === entry.id)
        ? { current: entry }
        : { current: entry, history: [entry, ...s.history].slice(0, HISTORY_LIMIT) },
    );
  },
  toggleLock(v) {
    set((s) => {
      const locked = { ...s.locked };
      if (locked[v]) delete locked[v];
      else locked[v] = true;
      return { locked };
    });
  },
  clearLocks: () => set({ locked: {} }),
  setUseAi: (useAi) => set({ useAi }),
  setStyleProfileId: (styleProfileId) => set({ styleProfileId }),
  dismissBatch: () => set({ batch: null }),
  markSaved: (entryId, sceneId) => set((s) => ({ saved: { ...s.saved, [entryId]: sceneId } })),
  forgetSaved: (sceneId) =>
    set((s) => ({ saved: Object.fromEntries(Object.entries(s.saved).filter(([, v]) => v !== sceneId)) })),

  async run(mode, { styleProfileId }) {
    const s = get();
    if (s.pending) return;
    const withBase = MODES_WITH_BASE.includes(mode);
    const base = withBase ? (s.current?.concept ?? null) : null;
    if ((mode === "similar" || mode === "new-direction") && !base) return;
    const locked = base ? s.locked : {};
    set({ pending: mode });
    try {
      const res = await api<ConceptResponse>("/api/concepts", {
        method: "POST",
        body: { mode, count: mode === "batch" ? 5 : 1, locked, base, useAi: s.useAi, styleProfileId },
      });
      const source: ConceptSource = res.source === "ai" ? { kind: "ai", model: res.model } : { kind: "engine" };
      // Time of day travels with lighting: keep it when lighting is locked.
      const concepts = res.concepts.map((c) => (base && locked.lighting ? { ...c, timeOfDay: base.timeOfDay } : c));
      if (!concepts.length) throw new Error("No concepts were returned. Try again.");
      if (mode === "batch") {
        set({ batch: concepts.map((c) => makeEntry(c, source)) });
      } else {
        get().setCurrent(makeEntry(concepts[0], source));
        set({ batch: null });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        set({ useAi: false });
        toast.error(err.message, { description: "Switched back to the built-in engine." });
      } else {
        toast.error("Could not generate concepts", { description: errorMessage(err) });
      }
    } finally {
      set({ pending: null });
    }
  },
}));
