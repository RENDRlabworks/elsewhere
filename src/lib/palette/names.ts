import { hexToHsl, hexToRgb, oklabDistance, rgbToOklab } from "./color";

/**
 * A curated vocabulary of colour names in the language of materials and nature.
 * Used to translate swatches into descriptive prompt language rather than hex codes.
 */
export const NAMED_COLORS: [string, string][] = [
  ["near-black", "#0a0a0b"],
  ["soft black", "#141414"],
  ["charcoal", "#2b2b2c"],
  ["graphite", "#3d3e40"],
  ["slate", "#4f5a61"],
  ["mineral gray", "#6e6f6c"],
  ["cold gray", "#8c9396"],
  ["foggy silver", "#b4b9b9"],
  ["pale silver", "#cfd3d4"],
  ["bone", "#dcd5c4"],
  ["ivory", "#ece6d6"],
  ["deep moss", "#2e3a24"],
  ["moss green", "#4b5a33"],
  ["pine", "#1f3328"],
  ["deep forest green", "#16251c"],
  ["muted olive", "#5f6140"],
  ["smoky olive", "#4e4a35"],
  ["sage", "#8a9a7e"],
  ["lichen", "#9aa38a"],
  ["subdued green", "#5d7058"],
  ["sea-glass green", "#7fa69a"],
  ["deep teal", "#1d3b3c"],
  ["storm teal", "#3e5d60"],
  ["glacial blue", "#9fc0cf"],
  ["ice blue", "#c6dbe3"],
  ["steel blue", "#4a6274"],
  ["deep ocean blue", "#16283a"],
  ["midnight blue", "#121a33"],
  ["indigo", "#262b55"],
  ["dusk violet", "#4a4060"],
  ["muted lavender", "#9a8fae"],
  ["dusty rose", "#b48a8c"],
  ["faded rose", "#c9a6a0"],
  ["oxblood", "#4a1c1c"],
  ["rust", "#8a4127"],
  ["copper", "#a8643a"],
  ["burnt sienna", "#8f4f2e"],
  ["terracotta", "#b0644a"],
  ["amber", "#c38a3e"],
  ["ochre", "#b58a45"],
  ["muted gold", "#a89060"],
  ["muted champagne", "#d6c49e"],
  ["sandstone", "#c2a27c"],
  ["pale sand", "#d8c8a8"],
  ["umber", "#5a412d"],
  ["weathered brown", "#6b5646"],
  ["peat", "#3a2e24"],
  ["basalt", "#26282a"],
  ["warm lamplight", "#e3b36e"],
  ["candle glow", "#f0c98a"],
  ["moon white", "#e8ebe8"],
];

const NAMED_LAB = NAMED_COLORS.map(([name, hex]) => ({ name, lab: rgbToOklab(hexToRgb(hex)) }));

export function nearestColorName(hex: string): string {
  const lab = rgbToOklab(hexToRgb(hex));
  let best = NAMED_LAB[0];
  let bestD = Infinity;
  for (const c of NAMED_LAB) {
    const d = oklabDistance(lab, c.lab);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.name;
}

/** "deep, muted moss green" style description for a single swatch. */
export function describeColor(hex: string): string {
  const name = nearestColorName(hex);
  const { s, l } = hexToHsl(hex);
  const mods: string[] = [];
  if (l < 0.12 && !/black|charcoal|basalt|peat/.test(name)) mods.push("very deep");
  else if (l > 0.82 && !/white|ivory|bone|silver|pale/.test(name)) mods.push("pale");
  if (s > 0.55 && l > 0.2 && l < 0.8) mods.push("rich");
  else if (s < 0.18 && l > 0.15 && l < 0.85 && !/gray|silver|slate|graphite|charcoal/.test(name)) mods.push("muted");
  return [...mods, name].join(" ");
}
