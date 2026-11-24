import { describe, expect, it } from "vitest";
import { characterSchema, sceneContentSchema } from "@/lib/domain/schemas";
import { IDEA_FIELDS } from "@/lib/domain/vocab";
import { createRng } from "@/lib/explore/engine";
import { hasIdeas, localIdeas } from "@/lib/explore/ideas";

const scene = (over: Record<string, unknown> = {}) =>
  sceneContentSchema.parse({
    title: "The Last Wish",
    environment: "a dark meadow",
    phenomenon: "a dandelion clock as tall as a tree",
    subject: { kind: "fox", action: "sitting upright" },
    ...over,
  });

describe("field ideas", () => {
  it("offers distinct ideas for every field that never repeat the current value", () => {
    const s = scene({ subject: { kind: "adult", action: "pausing mid-step" } });
    for (const field of IDEA_FIELDS) {
      const ideas = localIdeas(field, s, { count: 5, rand: createRng(7) });
      expect(ideas.length, field).toBeGreaterThan(0);
      expect(new Set(ideas.map((i) => i.toLowerCase())).size, field).toBe(ideas.length);
      expect(ideas, field).not.toContain(field === "action" ? "pausing mid-step" : (s as Record<string, unknown>)[field]);
    }
  });

  it("is deterministic for a seeded source of randomness", () => {
    expect(localIdeas("environment", scene(), { rand: createRng(42) })).toEqual(localIdeas("environment", scene(), { rand: createRng(42) }));
  });

  it("fits character ideas to the kind of subject", () => {
    const fox = characterSchema.parse({ kind: "fox" });
    const chair = characterSchema.parse({ kind: "object" });
    expect(hasIdeas("clothing", fox)).toBe(false);
    expect(hasIdeas("pose", chair)).toBe(false);
    expect(hasIdeas("clothing", chair)).toBe(true);
    expect(hasIdeas("subjectLabel", characterSchema.parse({ kind: "none" }))).toBe(false);
    const finishes = localIdeas("clothing", scene(), { character: chair, count: 10 });
    expect(finishes.some((f) => /wood|brass|enamel|paint|timber|iron|leather/.test(f))).toBe(true);
  });

  it("writes descriptions from the scene's own environment and phenomenon", () => {
    const [d] = localIdeas("description", scene({ description: "" }), { count: 1, rand: createRng(1) });
    expect(d).toContain("a dark meadow");
    expect(d).toContain("dandelion clock");
  });

  it("never uses em dashes", () => {
    for (const field of IDEA_FIELDS) for (const idea of localIdeas(field, scene({ subject: { kind: "adult" } }), { count: 50 })) expect(idea).not.toContain("\u2014");
  });
});

describe("dropdown suggestions", () => {
  it("offers large, grouped, duplicate-free lists without em dashes", async () => {
    const S = await import("@/lib/explore/suggestions");
    const lists = {
      environment: S.ENVIRONMENT_SUGGESTIONS,
      naturalElement: S.NATURAL_ELEMENT_SUGGESTIONS,
      materials: S.MATERIAL_SUGGESTIONS,
      lighting: S.LIGHTING_SUGGESTIONS,
      atmosphere: S.ATMOSPHERE_SUGGESTIONS,
      emotionalTone: S.EMOTIONAL_TONE_SUGGESTIONS,
    };
    for (const [name, groups] of Object.entries(lists)) {
      const all = S.flatten(groups);
      expect(all.length, name).toBeGreaterThanOrEqual(50);
      expect(groups.length, name).toBeGreaterThanOrEqual(4);
      expect(new Set(all.map((s) => s.toLowerCase())).size, name).toBe(all.length);
      expect(all.some((s) => s.includes("—")), name).toBe(false);
    }
  });

  it("fits character suggestions to the kind of subject", async () => {
    const { characterSuggestions, flatten } = await import("@/lib/explore/suggestions");
    expect(flatten(characterSuggestions("action", "horse")).length).toBeGreaterThan(10);
    expect(characterSuggestions("pose", "horse")).toEqual([]);
    expect(characterSuggestions("clothing", "whale")).toEqual([]);
    expect(flatten(characterSuggestions("clothing", "object"))).toContain("tarnished brass");
    expect(flatten(characterSuggestions("subjectLabel", "bird"))).toContain("a white heron");
  });
});
