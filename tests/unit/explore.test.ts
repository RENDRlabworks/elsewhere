import { describe, expect, it } from "vitest";
import { conceptSchema, sceneContentSchema } from "@/lib/domain/schemas";
import {
  conceptToScene,
  createRng,
  emptyHistory,
  generateConcept,
  generateConcepts,
  historyFromScenes,
  recordConcept,
} from "@/lib/explore/engine";

describe("exploration engine", () => {
  it("is deterministic for a given seed", () => {
    expect(generateConcepts("randomize-all", { seed: 42 })).toEqual(generateConcepts("randomize-all", { seed: 42 }));
    expect(generateConcepts("randomize-all", { seed: 42 })).not.toEqual(generateConcepts("randomize-all", { seed: 43 }));
  });

  it("produces schema-valid structured concepts", () => {
    for (const c of generateConcepts("batch", { seed: 7 })) expect(conceptSchema.safeParse(c).success).toBe(true);
  });

  it("generates five distinct concepts in batch mode", () => {
    const batch = generateConcepts("batch", { seed: 11 });
    expect(batch).toHaveLength(5);
    expect(new Set(batch.map((c) => c.phenomenon)).size).toBeGreaterThan(2);
  });

  it("preserves locked variables when randomizing unlocked fields", () => {
    const base = generateConcept({ rand: createRng(1) });
    for (let seed = 2; seed < 12; seed++) {
      const [c] = generateConcepts("randomize-unlocked", {
        seed,
        base,
        locked: { environment: base.environment, character: base.character },
      });
      expect(c.environment).toBe(base.environment);
      expect(c.character).toBe(base.character);
    }
  });

  it("changes every unlocked variable in new-direction mode", () => {
    const base = generateConcept({ rand: createRng(5) });
    const [c] = generateConcepts("new-direction", { seed: 99, base, locked: {} });
    expect(c.phenomenon).not.toBe(base.phenomenon);
    expect(c.environment).not.toBe(base.environment);
    expect(c.composition).not.toBe(base.composition);
  });

  it("discourages repeating heavily used options", () => {
    const history = emptyHistory();
    const seedConcept = generateConcept({ rand: createRng(3) });
    for (let i = 0; i < 40; i++) recordConcept(history, seedConcept);
    let repeats = 0;
    for (let seed = 0; seed < 40; seed++) {
      const [c] = generateConcepts("randomize-all", { seed, history });
      if (c.phenomenon === seedConcept.phenomenon) repeats++;
    }
    expect(repeats).toBeLessThan(3);
  });

  it("does not always place characters in the lower-left", () => {
    const anchors = new Set(generateConcepts("randomize-all", { seed: 1, count: 30 }).map((c) => c.anchor));
    expect(anchors.size).toBeGreaterThan(4);
  });

  it("translates a concept into a valid studio scene", () => {
    const c = generateConcept({ rand: createRng(8) });
    const scene = sceneContentSchema.parse(conceptToScene(c));
    expect(scene.environment).toBe(c.environment);
    expect(scene.composition.preset).toBe(c.composition);
    expect(scene.palette.swatches.map((s) => s.hex)).toEqual(c.palette);
  });

  it("builds history from scenes", () => {
    const s = sceneContentSchema.parse({ environment: "a meadow", subject: { kind: "fox" } });
    const h = historyFromScenes([s, s]);
    expect(h.character.fox).toBe(2);
    expect(h.environment["a meadow"]).toBe(2);
  });
});
