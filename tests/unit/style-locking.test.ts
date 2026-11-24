import { describe, expect, it } from "vitest";
import type { StyleProfile } from "@/lib/domain/schemas";
import { applyStylePatch, assertPatchAllowed, mergeRespectingLocks, StyleLockError } from "@/lib/style/locking";
import { ELSEWHERE_ORIGINAL } from "@/lib/style/presets";

function profile(over: Partial<StyleProfile> = {}): StyleProfile {
  return {
    id: "p1",
    userId: "u1",
    name: "Elsewhere Original",
    description: ELSEWHERE_ORIGINAL.description,
    attributes: structuredClone(ELSEWHERE_ORIGINAL.attributes),
    lockedAttributes: [],
    locked: false,
    archived: false,
    presetKey: "elsewhere-original",
    defaultPalette: [],
    currentVersion: 1,
    currentVersionId: "v1",
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

describe("style locking", () => {
  it("allows edits to unlocked attributes", () => {
    const { next, changed } = applyStylePatch(profile(), { attributes: { grain: "heavier grain" } });
    expect(changed).toBe(true);
    expect(next.attributes.grain).toBe("heavier grain");
  });

  it("rejects changes to individually locked attributes", () => {
    const p = profile({ lockedAttributes: ["lighting"] });
    expect(() => applyStylePatch(p, { attributes: { lighting: "neon" } })).toThrow(StyleLockError);
  });

  it("allows resending an unchanged locked value", () => {
    const p = profile({ lockedAttributes: ["lighting"] });
    expect(() => assertPatchAllowed(p, { attributes: { lighting: p.attributes.lighting, grain: "x" } })).not.toThrow();
  });

  it("rejects every content change on a fully locked profile, including the name", () => {
    const p = profile({ locked: true });
    expect(() => applyStylePatch(p, { attributes: { grain: "x" } })).toThrow(/Unlock the profile/);
    expect(() => applyStylePatch(p, { name: "Renamed" })).toThrow(StyleLockError);
  });

  it("reports no change when the patch is identical", () => {
    const p = profile();
    expect(applyStylePatch(p, { attributes: { grain: p.attributes.grain } }).changed).toBe(false);
  });

  it("protects locked attributes during AI refinement merges", () => {
    const p = profile({ lockedAttributes: ["exposure"] });
    const { merged, protectedKeys } = mergeRespectingLocks(p, { exposure: "bright", grain: "clean" });
    expect(merged.exposure).toBe(p.attributes.exposure);
    expect(merged.grain).toBe("clean");
    expect(protectedKeys).toEqual(["exposure"]);
  });
});
