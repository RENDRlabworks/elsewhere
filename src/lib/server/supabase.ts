import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "./env";

/** A Supabase client bound to the current request's auth cookies (RLS applies). */
export async function createRequestSupabase() {
  const url = env.supabaseUrl;
  const key = env.supabaseKey;
  if (!url || !key) throw new Error("Supabase is not configured");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a context that cannot set cookies; the proxy refreshes sessions.
        }
      },
    },
  });
}
