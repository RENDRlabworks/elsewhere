import { describe, expect, it } from "vitest";
import { LOADER_PATTERNS, patternFor } from "@/components/generation/generation-loader";
import { createRng } from "@/lib/explore/engine";

describe("generation loader patterns", () => {
  it("keeps one pattern per generation and never repeats the previous pick", () => {
    const rand = createRng(11);
    const picks = Array.from({ length: 200 }, (_, i) => patternFor(`gen-${i}`, rand));
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
    expect(new Set(picks).size).toBe(LOADER_PATTERNS.length);
    expect(patternFor("gen-5", rand)).toBe(picks[5]);
  });

  it("ships all ten Defacto patterns", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("public/vendor/dot-loader/dot-loader.js", "utf8");
    for (const p of LOADER_PATTERNS) expect(src).toContain(`PATTERNS.${p} =`);
  });
});
