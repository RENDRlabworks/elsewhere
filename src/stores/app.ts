"use client";

import { create } from "zustand";
import type { Preferences, StyleProfile } from "@/lib/domain/schemas";
import type { ImageModelConfig } from "@/lib/providers/image/types";
import { api } from "@/lib/client/api";

export type ProviderInfo = {
  id: string;
  label: string;
  configured: boolean;
  hint: string;
  defaultModel: string;
  models: ImageModelConfig[];
};

export type BootstrapPayload = {
  user: { id: string; email: string | null; mode: "local" | "supabase" };
  runtime: { dataMode: "local" | "supabase"; openaiConfigured: boolean; devProviderEnabled: boolean; ephemeralStorageWarning: boolean };
  preferences: Preferences;
  profiles: StyleProfile[];
  providers: ProviderInfo[];
  textAssist: { available: boolean; model: string };
};

type AppState = {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  data: BootstrapPayload | null;
  load: () => Promise<void>;
  setProfiles: (profiles: StyleProfile[]) => void;
  upsertProfile: (p: StyleProfile) => void;
  refreshProfiles: () => Promise<void>;
  updatePreferences: (patch: Record<string, unknown>) => Promise<Preferences>;
};

export const useApp = create<AppState>((set, get) => ({
  status: "idle",
  error: null,
  data: null,
  async load() {
    if (get().status === "loading") return;
    set({ status: "loading", error: null });
    try {
      const data = await api<BootstrapPayload>("/api/bootstrap");
      set({ data, status: "ready" });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  },
  setProfiles(profiles) {
    const d = get().data;
    if (d) set({ data: { ...d, profiles } });
  },
  upsertProfile(p) {
    const d = get().data;
    if (!d) return;
    const exists = d.profiles.some((x) => x.id === p.id);
    set({ data: { ...d, profiles: exists ? d.profiles.map((x) => (x.id === p.id ? p : x)) : [...d.profiles, p] } });
  },
  async refreshProfiles() {
    const { profiles } = await api<{ profiles: StyleProfile[] }>("/api/styles");
    get().setProfiles(profiles);
  },
  async updatePreferences(patch) {
    const { preferences } = await api<{ preferences: Preferences }>("/api/settings", { method: "PATCH", body: patch });
    const d = get().data;
    if (d) set({ data: { ...d, preferences } });
    return preferences;
  },
}));

/** Selectors. Fallbacks are module constants so selectors stay referentially stable. */
const NO_PROFILES: StyleProfile[] = [];
const NO_PROVIDERS: ProviderInfo[] = [];
export const usePreferences = () => useApp((s) => s.data?.preferences);
export const useProfiles = () => useApp((s) => s.data?.profiles ?? NO_PROFILES);
export const useRuntime = () => useApp((s) => s.data?.runtime);
export const useProviders = () => useApp((s) => s.data?.providers ?? NO_PROVIDERS);
