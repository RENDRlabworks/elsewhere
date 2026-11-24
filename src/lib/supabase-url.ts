/**
 * Reduce a configured Supabase URL to its origin.
 *
 * Supabase's dashboard shows several URLs, including the REST endpoint
 * (`https://<ref>.supabase.co/rest/v1/`). The client libraries append their own
 * paths, so anything after the host breaks auth and data requests. Accepting
 * any of those forms keeps a copy-paste slip from breaking sign-in.
 *
 * Safe to import from server, client and proxy code.
 */
export function normalizeSupabaseUrl(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}
