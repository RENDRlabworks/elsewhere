import { describe, expect, it } from "vitest";
import { sceneContentSchema } from "@/lib/domain/schemas";
import { assemblePrompt, applyTemplate, ensureOutputRequirements, OUTPUT_REQUIREMENTS } from "@/lib/prompt/assemble";
import { positionLanguage, subjectHeightLanguage } from "@/lib/prompt/language";
import { snapshotOf } from "@/lib/style/locking";
import { ELSEWHERE_ORIGINAL } from "@/lib/style/presets";

const style = snapshotOf({ ...ELSEWHERE_ORIGINAL, defaultPalette: ELSEWHERE_ORIGINAL.defaultPalette });

function scene(overrides: Record<string, unknown> = {}) {
  return sceneContentSchema.parse({
    title: "The Last Wish",
    description: "A fox beneath a monumental dandelion.",
    environment: "a dark meadow",
    phenomenon: "a dandelion clock as tall as a tree",
    subject: { kind: "fox", action: "sitting upright" },
    palette: { swatches: [{ id: "a", hex: "#16251c" }, { id: "b", hex: "#9aa38a" }] },
    ...overrides,
  });
}

describe("assemblePrompt", () => {
  it("is deterministic for identical inputs", () => {
    const a = assemblePrompt({ scene: scene(), style });
    const b = assemblePrompt({ scene: scene(), style });
    expect(a.text).toBe(b.text);
    expect(a.sections).toEqual(b.sections);
  });

  it("orders sections according to the specification", () => {
    const keys = assemblePrompt({ scene: scene(), style }).sections.map((s) => s.key);
    const expected = ["concept", "environment", "character", "action", "phenomenon", "scale", "composition", "materials", "lighting", "palette", "texture", "atmosphere", "emotion", "style", "constraints", "output"];
    expect(keys.filter((k) => expected.includes(k))).toEqual(expected.filter((k) => keys.includes(k)));
    expect(keys[0]).toBe("concept");
    expect(keys.at(-1)).toBe("output");
  });

  it("always includes standalone output constraints", () => {
    const text = assemblePrompt({ scene: scene(), style }).text.toLowerCase();
    for (const phrase of ["no collage", "no multiple panels", "no embedded text", "no watermark", "no logos", "single standalone"]) {
      expect(text).toContain(phrase);
    }
  });

  it("keeps output constraints when the user writes a manual override", () => {
    const r = assemblePrompt({ scene: scene({ promptOverride: "A fox in a meadow." }), style });
    expect(r.isManual).toBe(true);
    expect(r.text.startsWith("A fox in a meadow.")).toBe(true);
    expect(r.text).toContain(OUTPUT_REQUIREMENTS);
  });

  it("describes palettes in language, not only hex", () => {
    const palette = assemblePrompt({ scene: scene(), style }).sections.find((s) => s.key === "palette")!;
    expect(palette.text).toMatch(/forest|moss|pine|lichen|sage|green/i);
  });

  it("omits character sections and states it when there is no character", () => {
    const r = assemblePrompt({ scene: scene({ subject: { kind: "none" } }), style });
    expect(r.sections.find((s) => s.key === "character")!.text).toMatch(/no people, animals or characters/);
    expect(r.sections.find((s) => s.key === "action")).toBeUndefined();
  });

  it("only describes references that are actually submitted", () => {
    expect(assemblePrompt({ scene: scene(), style }).sections.some((s) => s.key === "references")).toBe(false);
    const r = assemblePrompt({ scene: scene(), style, references: [{ role: "lighting", label: "moon" }] });
    expect(r.sections.find((s) => s.key === "references")!.text).toContain("lighting reference");
  });

  it("includes prohibited style elements as constraints", () => {
    const r = assemblePrompt({ scene: scene(), style });
    expect(r.sections.find((s) => s.key === "constraints")!.text).toContain("watermarks");
  });

  it("applies custom templates and appends mandatory constraints if omitted", () => {
    const sections = assemblePrompt({ scene: scene(), style }).sections;
    const t = applyTemplate("PREFIX {{concept}}", sections);
    expect(t.startsWith("PREFIX")).toBe(true);
    expect(t).toContain("No collage");
  });

  it("does not duplicate constraints that are already present", () => {
    const once = ensureOutputRequirements(`hello\n\n${OUTPUT_REQUIREMENTS}`);
    expect(once.split("No collage").length).toBe(2);
  });

  it("marks sections derived from locked style attributes", () => {
    const r = assemblePrompt({ scene: scene(), style, lockedStyleKeys: ["lighting"] });
    expect(r.sections.find((s) => s.key === "lighting")!.locked).toBe(true);
  });
});

describe("scale and position language", () => {
  it("describes a 2% subject as almost imperceptibly small", () => {
    expect(subjectHeightLanguage(1.2)).toMatch(/imperceptibly small/);
    expect(subjectHeightLanguage(2)).toMatch(/tiny/);
    expect(subjectHeightLanguage(80)).toMatch(/filling most/);
  });

  it("describes approximate positions without claiming pixel precision", () => {
    expect(positionLanguage(0.1, 0.9)).toBe("placed approximately near the bottom of the frame, near the left edge");
    expect(positionLanguage(0.5, 0.5)).toBe("placed approximately at the centre of the frame");
    expect(positionLanguage(0.75, 0.3)).toContain("approximately");
  });
});
