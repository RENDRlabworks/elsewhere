import { describe, expect, it } from "vitest";
import { sceneContentSchema } from "@/lib/domain/schemas";
import { colourName, cropRect, defaultFocus, exportFilename, outputSize, templateShareText, tidyCopy } from "@/lib/share/presets";

describe("cropRect", () => {
  it("keeps the full frame for the original crop", () => {
    expect(cropRect(1024, 1280, "original")).toEqual({ left: 0, top: 0, width: 1024, height: 1280 });
  });

  it("cuts the largest window of the ratio that fits", () => {
    expect(cropRect(1024, 1280, "1:1", 0.5, 0.5)).toEqual({ left: 0, top: 128, width: 1024, height: 1024 });
    const wide = cropRect(1024, 1280, "16:9", 0.5, 0.5);
    expect(wide.width).toBe(1024);
    expect(wide.height).toBe(576);
  });

  it("keeps the subject at the same relative place in the crop", () => {
    // A subject near the top stays near the top: the window slides toward it.
    const top = cropRect(1000, 2000, "1:1", 0.5, 0.1);
    expect(top.top).toBe(100);
    const bottom = cropRect(1000, 2000, "1:1", 0.5, 1);
    expect(bottom.top).toBe(1000);
  });

  it("clamps focus outside the frame", () => {
    expect(cropRect(1000, 2000, "1:1", 0.5, 4).top).toBe(1000);
    expect(cropRect(1000, 2000, "1:1", 0.5, -1).top).toBe(0);
  });
});

describe("outputSize", () => {
  it("fits social exports to 1080 on the short edge without enlarging", () => {
    expect(outputSize(2048, 2560, "social")).toEqual({ width: 1080, height: 1350, upscaled: false });
    expect(outputSize(800, 1000, "social")).toEqual({ width: 800, height: 1000, upscaled: false });
  });

  it("fits web exports to 2048 on the long edge", () => {
    expect(outputSize(3000, 2000, "web")).toEqual({ width: 2048, height: 1365, upscaled: false });
  });

  it("enlarges for the large size", () => {
    expect(outputSize(1024, 1280, "large")).toEqual({ width: 3277, height: 4096, upscaled: true });
  });
});

describe("share text", () => {
  const scene = sceneContentSchema.parse({
    title: "The Frozen Hour",
    environment: "a frozen plain beneath a pale sky",
    phenomenon: "a single raindrop the size of a house, suspended above the ice",
    subject: { kind: "fox", action: "standing still" },
    lighting: "Soft diffuse light — before dawn",
  });
  const g = {
    title: "The Frozen Hour",
    sceneSnapshot: scene,
    styleSnapshot: null,
    paletteHexes: ["#0b1220", "#5d6f8a", "#dfe6ef"],
    environment: scene.environment,
  };

  it("writes alt text from the scene", () => {
    const { altText, caption } = templateShareText(g);
    expect(altText).toMatch(/^An image of a small fox, standing still, in a frozen plain/);
    expect(altText).toContain("A single raindrop the size of a house");
    expect(altText).toContain("Mostly");
    expect(caption.startsWith("The Frozen Hour")).toBe(true);
  });

  it("never writes em or en dashes", () => {
    const { altText, caption } = templateShareText(g);
    expect(altText + caption).not.toMatch(/[—–]/);
    expect(tidyCopy("Quiet — still – cold")).toBe("Quiet, still, cold");
  });

  it("names the medium from the look", () => {
    const painted = templateShareText({
      ...g,
      styleSnapshot: { name: "x", description: "", defaultPalette: [], attributes: { medium: "Painterly digital illustration. Not a photograph." } as never },
    });
    expect(painted.altText.startsWith("A painting")).toBe(true);
  });

  it("uses the composition as the default crop focus", () => {
    expect(defaultFocus({ sceneSnapshot: scene })).toEqual({ x: scene.composition.x, y: scene.composition.y });
    expect(defaultFocus({ sceneSnapshot: null })).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("helpers", () => {
  it("names colours in plain words", () => {
    expect(colourName("#000000")).toBe("black");
    expect(colourName("#808080")).toBe("grey");
    expect(colourName("#1d3b8a")).toBe("blue");
    expect(colourName("#0a1a40")).toBe("deep blue");
    expect(colourName("nope")).toBeNull();
  });

  it("builds file names", () => {
    expect(exportFilename("The Frozen Hour", { crop: "4:5", format: "jpeg" })).toBe("the-frozen-hour-4x5.jpg");
    expect(exportFilename("", { crop: "original", format: "png" })).toBe("elsewhere.png");
  });
});
