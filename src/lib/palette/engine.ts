import type { PaletteMode } from "@/lib/domain/vocab";
import type { ScenePalette, Swatch } from "@/lib/domain/schemas";
import { adjustHex, hexToHsl, hslToHex, hueFamily, luminance } from "./color";
import { describeColor } from "./names";

/** Material families and their characteristic palettes (dark to light). */
export const MATERIAL_PALETTES: { key: string; label: string; keywords: string[]; hexes: string[] }[] = [
  {
    key: "forest",
    label: "Forest",
    keywords: ["forest", "pine", "moss", "tree", "canopy", "woodland", "fern", "grove", "jungle", "root"],
    hexes: ["#0b0f0c", "#16251c", "#2e3a24", "#5f6140", "#9aa38a"],
  },
  {
    key: "ocean",
    label: "Ocean",
    keywords: ["ocean", "sea", "wave", "tide", "shore", "coast", "water", "lake", "river", "whale", "boat", "sailboat"],
    hexes: ["#0a0f12", "#1d3b3c", "#4f5a61", "#7fa69a", "#b4b9b9"],
  },
  {
    key: "desert",
    label: "Desert",
    keywords: ["desert", "dune", "sand", "canyon", "mesa", "arid", "sandstone"],
    hexes: ["#1a120c", "#5a412d", "#b0644a", "#b58a45", "#c2a27c"],
  },
  {
    key: "ice",
    label: "Ice",
    keywords: ["ice", "glacier", "frozen", "snow", "arctic", "frost", "polar", "raindrop"],
    hexes: ["#0b1014", "#4a6274", "#8c9396", "#9fc0cf", "#cfd3d4"],
  },
  {
    key: "autumn",
    label: "Autumn foliage",
    keywords: ["autumn", "fall", "leaf", "leaves", "copper", "harvest", "maple"],
    hexes: ["#140e0a", "#4e4a35", "#8a4127", "#a8643a", "#c38a3e"],
  },
  {
    key: "space",
    label: "Space",
    keywords: ["space", "cosmic", "cosmos", "universe", "star", "moon", "planet", "galaxy", "eclipse", "sky", "horizon"],
    hexes: ["#05060a", "#121a33", "#262b55", "#6b6a80", "#d6c49e"],
  },
  {
    key: "flowers",
    label: "Flowers",
    keywords: ["flower", "petal", "bloom", "garden", "meadow", "dandelion", "blossom", "field"],
    hexes: ["#0e0c0d", "#3a3340", "#5d7058", "#9a8fae", "#b48a8c"],
  },
  {
    key: "stone",
    label: "Stone",
    keywords: ["stone", "rock", "mountain", "cliff", "cathedral", "granite", "basalt", "cave", "mineral", "sphere", "staircase"],
    hexes: ["#0c0c0d", "#2b2b2c", "#6e6f6c", "#6b5646", "#a59e92"],
  },
  {
    key: "fungi",
    label: "Fungi and undergrowth",
    keywords: ["mushroom", "fungi", "fungus", "spore", "lichen", "undergrowth"],
    hexes: ["#0d0b09", "#3a2e24", "#6b5646", "#c9a6a0", "#dcd5c4"],
  },
  {
    key: "cloud",
    label: "Cloud and fog",
    keywords: ["cloud", "fog", "mist", "haze", "storm", "atmosphere"],
    hexes: ["#0e0f11", "#3d3e40", "#6e6f6c", "#b4b9b9", "#e8ebe8"],
  },
];

let swatchCounter = 0;
export function makeSwatch(hex: string, locked = false): Swatch {
  swatchCounter = (swatchCounter + 1) % 1_000_000;
  return { id: `sw-${Date.now().toString(36)}-${swatchCounter}`, hex, locked };
}

/** Score each material family against the scene's text and return the best matches. */
export function detectMaterials(text: string): { key: string; label: string; score: number }[] {
  const t = text.toLowerCase();
  return MATERIAL_PALETTES.map((m) => ({
    key: m.key,
    label: m.label,
    score: m.keywords.reduce((acc, k) => acc + (t.match(new RegExp(`\\b${k}`, "g"))?.length ?? 0), 0),
  }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Build a material-inspired palette by blending the top material families for the scene. */
export function materialPalette(text: string, count = 5): string[] {
  const found = detectMaterials(text);
  if (!found.length) return MATERIAL_PALETTES.find((m) => m.key === "stone")!.hexes.slice(0, count);
  const primary = MATERIAL_PALETTES.find((m) => m.key === found[0].key)!.hexes;
  if (found.length === 1) return primary.slice(0, count);
  const secondary = MATERIAL_PALETTES.find((m) => m.key === found[1].key)!.hexes;
  // Keep the primary's shadows and body; borrow the secondary's accent.
  return [primary[0], primary[1], primary[2], secondary[3], primary[4]].slice(0, count);
}

function lightnessRamp(count: number) {
  // Dark-weighted ramp, in keeping with predominantly dark imagery.
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(0.06 + (0.78 * i ** 1.35) / (count - 1) ** 1.35);
  return out;
}

/** Derive a harmony palette from a base colour. */
export function harmonyPalette(mode: PaletteMode, baseHex: string, count = 5): string[] {
  const base = hexToHsl(baseHex);
  const ramp = lightnessRamp(count);
  const sat = Math.max(0.08, Math.min(0.45, base.s));
  switch (mode) {
    case "monochromatic":
      return ramp.map((l) => hslToHex({ h: base.h, s: sat * 0.8, l }));
    case "near-monochromatic":
      return ramp.map((l, i) => hslToHex({ h: base.h + (i - count / 2) * 6, s: sat * 0.6, l }));
    case "analogous":
      return ramp.map((l, i) => hslToHex({ h: base.h + (i - (count - 1) / 2) * 24, s: sat, l }));
    case "complementary":
      return ramp.map((l, i) =>
        hslToHex({ h: i === count - 2 ? base.h + 180 : base.h, s: i === count - 2 ? sat * 0.9 : sat * 0.7, l }),
      );
    case "duotone": {
      const other = base.h + 150;
      return ramp.map((l, i) => hslToHex({ h: i < count / 2 ? base.h : other, s: sat * 0.75, l }));
    }
    default:
      return ramp.map((l) => hslToHex({ h: base.h, s: sat, l }));
  }
}

/**
 * Produce swatches for a palette mode, keeping locked swatches in place.
 * `sourceHexes` are used for style, reference and material modes.
 */
export function regeneratePalette(
  current: Swatch[],
  mode: PaletteMode,
  opts: { sceneText?: string; styleHexes?: string[]; referenceHexes?: string[]; count?: number },
): Swatch[] {
  const count = Math.max(current.length || 0, opts.count ?? 5);
  let hexes: string[];
  const baseHex = current.find((s) => s.locked)?.hex ?? current[Math.floor(current.length / 2)]?.hex ?? "#3c4a42";
  switch (mode) {
    case "material":
      hexes = materialPalette(opts.sceneText ?? "", count);
      break;
    case "style":
      hexes = opts.styleHexes?.length ? opts.styleHexes : materialPalette(opts.sceneText ?? "", count);
      break;
    case "reference":
      hexes = opts.referenceHexes?.length ? opts.referenceHexes : current.map((s) => s.hex);
      break;
    case "custom":
      hexes = current.map((s) => s.hex);
      break;
    default:
      hexes = harmonyPalette(mode, baseHex, count);
  }
  const out: Swatch[] = [];
  let hi = 0;
  for (let i = 0; i < Math.max(count, current.length); i++) {
    const existing = current[i];
    if (existing?.locked) {
      out.push(existing);
      continue;
    }
    const hex = hexes[hi++ % Math.max(1, hexes.length)];
    if (!hex) continue;
    out.push(existing ? { ...existing, hex } : makeSwatch(hex));
  }
  return out.slice(0, 12);
}

/** Effective swatches after global saturation, warmth and contrast adjustments. */
export function effectiveSwatches(p: Pick<ScenePalette, "swatches" | "saturation" | "warmth" | "contrast">): string[] {
  return p.swatches.map((s) => adjustHex(s.hex, p));
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Translate a palette into descriptive colour language for the prompt.
 * Hex values are included only as a secondary, parenthetical hint.
 */
export function paletteToLanguage(p: Pick<ScenePalette, "swatches" | "saturation" | "warmth" | "contrast" | "mode">): string {
  const hexes = effectiveSwatches(p);
  if (!hexes.length) return "";
  const sorted = [...hexes].sort((a, b) => luminance(a) - luminance(b));
  const names = [...new Set(sorted.map(describeColor))];
  const darks = sorted.filter((h) => luminance(h) < 0.04);
  const lights = sorted.filter((h) => luminance(h) > 0.35);
  const families = new Set(hexes.map(hueFamily).filter((f) => !["black", "white", "neutral"].includes(f)));

  const parts: string[] = [];
  const modeLead: Partial<Record<PaletteMode, string>> = {
    monochromatic: "A monochromatic palette",
    "near-monochromatic": "A near-monochromatic palette",
    duotone: "A restrained duotone palette",
    complementary: "A restrained palette with a single quiet complementary accent",
    analogous: "An analogous palette of neighbouring hues",
  };
  parts.push(`${modeLead[p.mode] ?? "A restrained, material-driven palette"} of ${joinList(names)}`);
  if (darks.length >= Math.ceil(hexes.length / 3)) parts.push("shadows fall to near-black");
  if (lights.length) parts.push(`the brightest tones are reserved for ${describeColor(lights[lights.length - 1])} highlights`);
  if (families.size <= 1) parts.push("hue variation is kept minimal");
  if (p.saturation < -30) parts.push("colour is heavily desaturated");
  else if (p.saturation > 30) parts.push("colour carries a little more saturation than usual, still natural");
  else parts.push("saturation stays restrained");
  if (p.warmth > 30) parts.push("the overall temperature leans warm");
  else if (p.warmth < -30) parts.push("the overall temperature leans cool");
  if (p.contrast > 30) parts.push("tonal contrast is pronounced");
  else if (p.contrast < -30) parts.push("tonal contrast is soft and compressed");
  return `${parts.join("; ")}. (Approximate reference values: ${hexes.join(", ")}.)`;
}
