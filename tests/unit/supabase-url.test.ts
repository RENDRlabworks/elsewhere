import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "@/lib/supabase-url";

describe("normalizeSupabaseUrl", () => {
  it("keeps a bare project URL", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co")).toBe("https://abc.supabase.co");
  });

  it("strips the REST path, trailing slashes and whitespace copied from the dashboard", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl("  https://abc.supabase.co/  ")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl("http://127.0.0.1:54321/auth/v1")).toBe("http://127.0.0.1:54321");
  });

  it("returns undefined when unset", () => {
    expect(normalizeSupabaseUrl(undefined)).toBeUndefined();
    expect(normalizeSupabaseUrl("   ")).toBeUndefined();
  });
});
