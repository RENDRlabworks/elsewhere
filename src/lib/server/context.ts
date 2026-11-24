import "server-only";
import type { Database } from "@/lib/data/types";
import { createLocalDatabase } from "@/lib/data/local";
import { createSupabaseDatabase } from "@/lib/data/supabase";
import { createLocalStorage, createSupabaseStorage, type ObjectStorage } from "@/lib/storage";
import { dataMode, env, type DataMode } from "./env";
import { createRequestSupabase } from "./supabase";
import { HttpError } from "./http";

export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";

export type ServerContext = {
  mode: DataMode;
  userId: string;
  email: string | null;
  db: Database;
  storage: ObjectStorage;
};

/**
 * Resolve the authenticated user and their data access handles for this request.
 * Throws 401 when Supabase mode is active and nobody is signed in.
 */
export async function getContext(): Promise<ServerContext> {
  const mode = dataMode();
  if (mode === "local") {
    return {
      mode,
      userId: LOCAL_USER_ID,
      email: null,
      db: createLocalDatabase(LOCAL_USER_ID, env.dataDir),
      storage: createLocalStorage(env.dataDir),
    };
  }
  const supabase = await createRequestSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) throw new HttpError(401, "Sign in to continue");
  return {
    mode,
    userId: sub,
    email: (data.claims.email as string | undefined) ?? null,
    db: createSupabaseDatabase(supabase, sub),
    storage: createSupabaseStorage(supabase),
  };
}
