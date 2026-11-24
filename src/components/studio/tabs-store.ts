"use client";

import { create } from "zustand";
import type { CreateTabs } from "@/lib/domain/schemas";
import { useApp } from "@/stores/app";

/**
 * Tabs in Create, like a browser or Figma: each tab holds one scene, or the start
 * screen until something is chosen. Closing a tab never deletes its scene. The set
 * of open tabs is saved to preferences so it follows the user between devices.
 */

export type CreateTab = CreateTabs["tabs"][number];

const MAX_TABS = 20;
const newId = () => Math.random().toString(36).slice(2, 10);

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist(tabs: CreateTab[], activeId: string | null) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void useApp
      .getState()
      .updatePreferences({ createTabs: { tabs, activeId } })
      .catch(() => {
        // Tabs still work for this visit; they sync on the next change.
      });
  }, 400);
}

type TabsState = {
  tabs: CreateTab[];
  activeId: string | null;
  hydrated: boolean;
  /** Load the saved tabs once per visit. Always leaves at least one tab open. */
  hydrate: (saved: CreateTabs | undefined) => void;
  active: () => CreateTab | null;
  activate: (id: string) => CreateTab | null;
  /** Open a new tab (on the start screen unless a scene is given) and make it active. */
  newTab: (sceneId?: string | null) => CreateTab;
  /** Close a tab. Returns the tab that is active afterwards. */
  close: (id: string) => CreateTab;
  /** The active tab now shows this scene. */
  setActiveScene: (sceneId: string | null) => void;
  /**
   * Show a scene: switch to its tab if one is open, reuse the active tab if it is on
   * the start screen, otherwise open a new tab for it.
   */
  openScene: (sceneId: string) => CreateTab;
  /** Make sure the active tab is free for new work (a start-screen tab). */
  ensureFreeTab: () => CreateTab;
};

export const useTabs = create<TabsState>((set, get) => {
  const commit = (tabs: CreateTab[], activeId: string | null) => {
    set({ tabs, activeId });
    persist(tabs, activeId);
  };

  return {
    tabs: [],
    activeId: null,
    hydrated: false,

    hydrate(saved) {
      if (get().hydrated) return;
      const seen = new Set<string>();
      const tabs = (saved?.tabs ?? []).filter((t) => {
        // One tab per scene; drop duplicates that could come from two devices.
        if (!t.sceneId) return true;
        if (seen.has(t.sceneId)) return false;
        seen.add(t.sceneId);
        return true;
      });
      if (!tabs.length) tabs.push({ id: newId(), sceneId: null });
      const activeId = tabs.some((t) => t.id === saved?.activeId) ? saved!.activeId : tabs[tabs.length - 1].id;
      set({ tabs, activeId, hydrated: true });
    },

    active: () => get().tabs.find((t) => t.id === get().activeId) ?? null,

    activate(id) {
      const tab = get().tabs.find((t) => t.id === id) ?? null;
      if (tab && tab.id !== get().activeId) commit(get().tabs, tab.id);
      return tab;
    },

    newTab(sceneId = null) {
      const tabs = [...get().tabs];
      if (tabs.length >= MAX_TABS) {
        // Make room by closing the oldest tab that is not in view.
        const drop = tabs.findIndex((t) => t.id !== get().activeId);
        tabs.splice(drop, 1);
      }
      const tab = { id: newId(), sceneId };
      const at = tabs.findIndex((t) => t.id === get().activeId);
      tabs.splice(at >= 0 ? at + 1 : tabs.length, 0, tab);
      commit(tabs, tab.id);
      return tab;
    },

    close(id) {
      const tabs = get().tabs;
      const i = tabs.findIndex((t) => t.id === id);
      if (i < 0) return get().active() ?? get().newTab();
      const rest = tabs.filter((t) => t.id !== id);
      if (!rest.length) {
        const fresh = { id: newId(), sceneId: null };
        commit([fresh], fresh.id);
        return fresh;
      }
      const activeId = get().activeId === id ? rest[Math.min(i, rest.length - 1)].id : get().activeId;
      commit(rest, activeId);
      return rest.find((t) => t.id === activeId)!;
    },

    setActiveScene(sceneId) {
      const { tabs, activeId } = get();
      const cur = tabs.find((t) => t.id === activeId);
      if (!cur || cur.sceneId === sceneId) return;
      // If another tab already shows this scene, fold this tab into it.
      const other = sceneId ? tabs.find((t) => t.sceneId === sceneId && t.id !== activeId) : null;
      if (other) {
        commit(
          tabs.filter((t) => t.id !== activeId),
          other.id,
        );
        return;
      }
      commit(
        tabs.map((t) => (t.id === activeId ? { ...t, sceneId } : t)),
        activeId,
      );
    },

    openScene(sceneId) {
      const existing = get().tabs.find((t) => t.sceneId === sceneId);
      if (existing) return get().activate(existing.id)!;
      const cur = get().active();
      if (cur && !cur.sceneId) {
        get().setActiveScene(sceneId);
        return get().active()!;
      }
      return get().newTab(sceneId);
    },

    ensureFreeTab() {
      const cur = get().active();
      if (cur && !cur.sceneId) return cur;
      return get().newTab(null);
    },
  };
});
