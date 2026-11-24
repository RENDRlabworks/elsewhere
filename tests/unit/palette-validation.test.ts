import { describe, expect, it } from "vitest";
import {
  conceptRequestSchema,
  generationRequestSchema,
  sceneContentSchema,
  styleLockSchema,
} from "@/lib/domain/schemas";
import { adjustHex, hexToHsl, normalizeHex } from "@/lib/palette/color";
import { detectMaterials, harmonyPalette, materialPalette, paletteToLanguage, regeneratePalette } from "@/lib/palette/engine";
import { extractDominantColors } from "@/lib/palette/extract";
import { describeColor } from "@/lib/palette/names";
import { computeInsights, evenness } from "@/lib/composition/analytics";

describe("palette engine", () => {
  it("normalises hex values", () => {
    expect(normalizeHex("ABC")).toBe("#aabbcc");
    expect(() => normalizeHex("#zzzzzz")).toThrow();
  });

  it("detects materials from scene text", () => {
    expect(detectMaterials("a fox in a pine forest with moss")[0].key).toBe("forest");
    expect(materialPalette("a desert of sandstone dunes")).toHaveLength(5);
  });

  it("names colours in material language", () => {
    expect(describeColor("#2e3a24")).toMatch(/moss/);
    expect(describeColor("#0a0a0b")).toMatch(/black/);
  });

  it("keeps locked swatches when regenerating", () => {
    const current = [
      { id: "1", hex: "#ff0000", locked: true },
      { id: "2", hex: "#00ff00", locked: false },
    ];
    const next = regeneratePalette(current, "monochromatic", { count: 5 });
    expect(next[0]).toEqual(current[0]);
    expect(next.length).toBe(5);
  });

  it("produces dark-weighted monochromatic ramps sharing one hue", () => {
    const ramp = harmonyPalette("monochromatic", "#4b5a33");
    const visible = ramp.map(hexToHsl).filter((c) => c.l > 0.15);
    const base = hexToHsl("#4b5a33").h;
    for (const c of visible) expect(Math.abs(c.h - base)).toBeLessThan(12);
    expect(hexToHsl(ramp[0]).l).toBeLessThan(hexToHsl(ramp.at(-1)!).l);
  });

  it("adjusts warmth toward red and away from blue", () => {
    const warm = adjustHex("#808080", { warmth: 100 });
    expect(parseInt(warm.slice(1, 3), 16)).toBeGreaterThan(parseInt(warm.slice(5, 7), 16));
  });

  it("describes palettes with words and approximate hex hints", () => {
    const text = paletteToLanguage({
      mode: "material",
      swatches: [{ id: "a", hex: "#16251c", locked: false }, { id: "b", hex: "#9aa38a", locked: false }],
      saturation: -50,
      warmth: 0,
      contrast: 0,
    });
    expect(text).toMatch(/desaturated/);
    expect(text).toMatch(/Approximate reference values/);
  });

  it("extracts dominant colours from pixels", () => {
    const px = new Uint8ClampedArray(400 * 4);
    for (let i = 0; i < 400; i++) {
      const c = i < 200 ? [10, 10, 10] : [200, 180, 140];
      px.set([...c, 255], i * 4);
    }
    const colors = extractDominantColors(px, 2);
    expect(colors).toEqual(["#0a0a0a", "#c8b48c"]);
  });
});

describe("validation", () => {
  it("fills scene defaults and rejects out-of-range values", () => {
    const s = sceneContentSchema.parse({});
    expect(s.composition.x).toBe(0.5);
    expect(s.output.count).toBe(1);
    expect(sceneContentSchema.safeParse({ composition: { x: 2 } }).success).toBe(false);
    expect(sceneContentSchema.safeParse({ output: { count: 9 } }).success).toBe(false);
    expect(sceneContentSchema.safeParse({ palette: { swatches: [{ id: "a", hex: "red" }] } }).success).toBe(false);
  });

  it("requires an idempotency key on generation requests", () => {
    expect(generationRequestSchema.safeParse({ scene: {} }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ scene: {}, idempotencyKey: "abcdefgh" }).success).toBe(true);
  });

  it("validates lock payloads and concept requests", () => {
    expect(styleLockSchema.safeParse({ lockedAttributes: ["notAnAttribute"] }).success).toBe(false);
    expect(conceptRequestSchema.safeParse({ mode: "surprise" }).success).toBe(true);
    expect(conceptRequestSchema.safeParse({ mode: "chaos" }).success).toBe(false);
  });
});

describe("composition analytics", () => {
  it("computes evenness", () => {
    expect(evenness([5, 5, 5], 3)).toBeCloseTo(1);
    expect(evenness([15, 0, 0], 3)).toBe(0);
  });

  it("detects repeated placements and suggests underused compositions", () => {
    const s = sceneContentSchema.parse({ subject: { kind: "adult" }, composition: { x: 0.1, y: 0.9, anchor: "lower-left", preset: "rule-of-thirds" } });
    const insights = computeInsights(Array.from({ length: 6 }, () => ({ sceneSnapshot: s, reviewStatus: "accepted" as const, status: "completed" as const })));
    expect(insights.repeatedPatterns.length).toBeGreaterThan(0);
    expect(insights.heatmap[4][0]).toBe(6);
    expect(insights.suggestions.some((x) => x.kind === "composition" && x.key !== "rule-of-thirds")).toBe(true);
    expect(insights.acceptance.rate).toBe(1);
  });
});

describe("patch schemas", () => {
  it("never fill omitted fields with defaults", async () => {
    const { sceneUpdateSchema, styleProfileUpdateSchema, preferencesPatchSchema } = await import("@/lib/domain/schemas");
    expect(sceneUpdateSchema.parse({ title: "x" })).toEqual({ title: "x" });
    expect(styleProfileUpdateSchema.parse({ attributes: { grain: "g" } })).toEqual({ attributes: { grain: "g" } });
    expect(preferencesPatchSchema.parse({ ui: { theme: "black" } })).toEqual({ ui: { theme: "black" } });
  });
});
