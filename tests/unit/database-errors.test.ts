import { describe, expect, it } from "vitest";
import { isMissingTableError } from "@/lib/data/supabase";

describe("isMissingTableError", () => {
  it("recognises PostgREST and Postgres missing-table errors", () => {
    expect(isMissingTableError({ code: "PGRST205", message: "x" })).toBe(true);
    expect(isMissingTableError({ code: "42P01", message: "x" })).toBe(true);
    expect(isMissingTableError({ message: "Could not find the table 'public.user_preferences' in the schema cache" })).toBe(true);
    expect(isMissingTableError({ message: 'relation "public.scenes" does not exist' })).toBe(true);
  });

  it("ignores other database errors", () => {
    expect(isMissingTableError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
  });
});
