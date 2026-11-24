"use client";

import { create } from "zustand";
import type { Generation } from "@/lib/domain/schemas";
import { DEFAULT_EXPORT, type ExportOptions } from "@/lib/share/presets";

export type ShareTarget =
  | { kind: "image"; generation: Generation }
  | { kind: "images"; ids: string[] }
  | { kind: "collection"; id: string; name: string; count: number };

const KEY = "elsewhere.share.options";

function readOptions(): ExportOptions {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_EXPORT;
    const v = JSON.parse(raw) as Partial<ExportOptions>;
    return { crop: v.crop ?? DEFAULT_EXPORT.crop, size: v.size ?? DEFAULT_EXPORT.size, format: v.format ?? DEFAULT_EXPORT.format };
  } catch {
    return DEFAULT_EXPORT;
  }
}

/** Global Share sheet. Crop, size and format are remembered per browser. */
export const useShareSheet = create<{
  target: ShareTarget | null;
  options: ExportOptions;
  show: (t: ShareTarget) => void;
  close: () => void;
  setOptions: (o: Partial<ExportOptions>) => void;
}>((set, get) => ({
  target: null,
  options: DEFAULT_EXPORT,
  show: (target) => set({ target, options: { ...readOptions(), focusX: undefined, focusY: undefined } }),
  close: () => set({ target: null }),
  setOptions: (o) => {
    const options = { ...get().options, ...o };
    set({ options });
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ crop: options.crop, size: options.size, format: options.format }));
    } catch {
      // Remembering the choice is a convenience only.
    }
  },
}));

export const shareImage = (generation: Generation) => useShareSheet.getState().show({ kind: "image", generation });
