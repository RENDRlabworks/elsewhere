import "server-only";
import { normalizeSupabaseUrl } from "@/lib/supabase-url";

/**
 * Centralised, server-only environment access.
 * Secrets are read here and never serialised to the client. Only booleans and
 * non-sensitive identifiers leave this module (see `publicRuntimeInfo`).
 */

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export const env = {
  get supabaseUrl() {
    return normalizeSupabaseUrl(read("NEXT_PUBLIC_SUPABASE_URL"));
  },
  get supabaseKey() {
    return read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get openaiKey() {
    return read("OPENAI_API_KEY");
  },
  get openaiBaseUrl() {
    return read("OPENAI_BASE_URL");
  },
  get openaiOrg() {
    return read("OPENAI_ORG_ID");
  },
  get openaiImageModel() {
    return read("OPENAI_IMAGE_MODEL");
  },
  get openaiTextModel() {
    return read("OPENAI_TEXT_MODEL");
  },
  get dataDir() {
    return read("ELSEWHERE_DATA_DIR") ?? ".elsewhere-data";
  },
  get forcedMode() {
    const m = read("ELSEWHERE_DATA_MODE");
    return m === "local" || m === "supabase" ? m : undefined;
  },
  get devProviderSetting() {
    return read("ELSEWHERE_DEV_PROVIDER");
  },
  /** Server-side hard ceiling on images per user per day, regardless of user preferences. */
  get hardDailyImageCap() {
    const n = Number(read("ELSEWHERE_HARD_DAILY_IMAGE_CAP") ?? "200");
    return Number.isFinite(n) && n >= 0 ? n : 200;
  },
  get isVercel() {
    return !!read("VERCEL");
  },
};

export type DataMode = "local" | "supabase";

export function dataMode(): DataMode {
  if (env.forcedMode) return env.forcedMode;
  return env.supabaseUrl && env.supabaseKey ? "supabase" : "local";
}

/** The development sketch provider renders labelled composition studies, never artwork. */
export function devProviderEnabled(): boolean {
  const s = env.devProviderSetting;
  if (s === "0" || s === "false") return false;
  if (s === "1" || s === "true") return true;
  return dataMode() === "local";
}

export function publicRuntimeInfo() {
  return {
    dataMode: dataMode(),
    openaiConfigured: !!env.openaiKey,
    devProviderEnabled: devProviderEnabled(),
    ephemeralStorageWarning: dataMode() === "local" && env.isVercel,
  };
}
export type RuntimeInfo = ReturnType<typeof publicRuntimeInfo>;
