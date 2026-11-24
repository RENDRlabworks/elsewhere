"use client";

import { create } from "zustand";

type UiState = {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  inspectorOpen: boolean;
  scenePanelOpen: boolean;
  fullscreen: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
  toggleInspector: () => void;
  toggleScenePanel: () => void;
  setFullscreen: (v: boolean) => void;
};

export const useUi = create<UiState>((set) => ({
  sidebarCollapsed: false,
  commandOpen: false,
  inspectorOpen: true,
  scenePanelOpen: true,
  fullscreen: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setCommandOpen: (v) => set({ commandOpen: v }),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  toggleScenePanel: () => set((s) => ({ scenePanelOpen: !s.scenePanelOpen })),
  setFullscreen: (v) => set({ fullscreen: v }),
}));

/**
 * A lightweight command bus so the command palette and keyboard shortcuts can
 * trigger page-level actions (generate, randomize, copy prompt) without coupling.
 */
type Handler = () => void;
const handlers = new Map<string, Set<Handler>>();

export function onCommand(name: string, h: Handler) {
  if (!handlers.has(name)) handlers.set(name, new Set());
  handlers.get(name)!.add(h);
  return () => {
    handlers.get(name)!.delete(h);
  };
}

export function runCommand(name: string): boolean {
  const set = handlers.get(name);
  if (!set?.size) return false;
  set.forEach((h) => h());
  return true;
}

export function hasCommand(name: string) {
  return !!handlers.get(name)?.size;
}
