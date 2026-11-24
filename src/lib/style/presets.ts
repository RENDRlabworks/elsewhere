import type { StyleAttributes, Swatch } from "@/lib/domain/schemas";

export type StylePreset = {
  key: string;
  name: string;
  description: string;
  attributes: StyleAttributes;
  defaultPalette: Swatch[];
};

const sw = (prefix: string, hexes: string[], names: string[] = []): Swatch[] =>
  hexes.map((hex, i) => ({ id: `${prefix}-${i}`, hex, locked: false, name: names[i] }));

const SHARED_PROHIBITED = [
  "typography or lettering within the image",
  "borders or frames",
  "watermarks",
  "logos",
  "collages",
  "multi-panel compositions",
];

export const ELSEWHERE_ORIGINAL: StylePreset = {
  key: "elsewhere-original",
  name: "Elsewhere Original",
  description:
    "Surreal fine-art photography depicting familiar things in impossible worlds. Photographs captured in places that cannot exist.",
  attributes: {
    medium: "Surreal fine-art photography",
    renderingStyle:
      "Photographic realism in materials and light; impossibility is introduced only through scale, perspective, gravity and environmental relationships",
    photographic:
      "Feels like a single photograph captured on location with a large-format camera; natural lens behaviour, believable depth of field, no digital sheen",
    exposure:
      "Predominantly dark exposure with deep near-black shadows, restrained illumination, extreme tonal depth, large areas of low visual activity and natural highlight falloff. Darkness is an intentional compositional element",
    contrast: "High tonal range held with restraint; soft shoulder in the highlights, no crushed or clipped midtones",
    shadowDepth: "Deep, near-black shadows that keep subtle detail and swallow large parts of the frame",
    lighting:
      "One dominant light source; localized illumination; natural moonlight or soft backlighting; diffused reflected light; gentle atmospheric scattering; restrained volumetric light. No artificially glowing objects unless the scene requires them",
    colorPhilosophy:
      "Color is determined by the materials, environment and emotional tone of each scene. Never force a blue-purple palette. Forests: deep moss, pine, charcoal, muted olive. Oceans: sea-glass green, slate, foggy silver. Deserts: sandstone, ochre, terracotta, umber. Ice: glacial blue, pale silver, cold gray. Autumn: copper, rust, amber, smoky olive. Space: midnight blue, indigo, muted champagne. Flowers: dusty rose, muted lavender, subdued greens. Stone: charcoal, mineral gray, weathered brown",
    saturation: "Restrained saturation; no unnecessary color accents",
    texture:
      "Realistic material texture, soft atmospheric transitions, subtle atmospheric particles and slight photographic imperfections. No repetitive painterly textures or decorative surface patterns",
    grain: "Authentic analog photographic grain with fine organic noise",
    atmosphericDepth: "Air you can feel: layered haze and soft scattering that separates near and far",
    compositionPhilosophy:
      "Monumental natural environments with tiny characters for scale; generous negative space; varied subject placement, never defaulting to the lower-left corner",
    subjectTreatment:
      "Subjects are small, quiet and believable; readable as silhouettes; varied in species, posture and placement",
    environmentalTreatment:
      "Monumental, impossible natural proportions and surreal geological formations; environments that dwarf their inhabitants with purpose, not ornament",
    emotionalCharacter:
      "Quiet wonder, solitude, contemplation, mystery, peaceful melancholy, stillness, belonging, awe, introspection, transcendence",
    requiredElements: ["a sense of monumental scale", "intentional darkness", "one dominant light source"],
    prohibitedElements: [
      ...SHARED_PROHIBITED,
      "generic fantasy illustration",
      "video-game concept art",
      "oversaturated neon",
      "artificial magical glows",
      "excessive stars",
      "excessive nebula effects",
      "overly polished CGI",
      "plastic-looking materials",
    ],
    positiveInstructions:
      "Prioritize realism in materials and light. Let impossibility arrive quietly. Keep the frame calm and purposeful.",
    negativeConstraints:
      "Avoid excessive visual complexity, elaborate environments without purpose, repetitive compositions and repetitive character silhouettes.",
  },
  defaultPalette: sw("eo", ["#0b0c0e", "#1d2321", "#3c4a42", "#8a8f86", "#cfc6b0"], [
    "near black",
    "charcoal moss",
    "deep pine",
    "mineral gray",
    "bone",
  ]),
};

const COSMIC_MINIMALISM: StylePreset = {
  key: "cosmic-minimalism",
  name: "Cosmic Minimalism",
  description: "Vast, nearly empty cosmic spaces reduced to a few elements. Silence at astronomical scale.",
  attributes: {
    ...ELSEWHERE_ORIGINAL.attributes,
    medium: "Minimalist fine-art photography with a cosmic sensibility",
    exposure: "Deep blacks dominate; a single field of soft light provides the only real tonal event",
    lighting: "A single distant light source such as a planet's terminator, a low moon or a faint aurora; nothing else glows",
    colorPhilosophy: "Midnight blue, indigo and muted champagne; occasional warm dust tones. Very few hues per frame",
    compositionPhilosophy: "Extreme negative space; one or two elements; strong horizontal calm or central isolation",
    environmentalTreatment: "Space and landscape merge; horizons dissolve into the cosmos; scale is planetary",
    emotionalCharacter: "Awe, transcendence, solitude, stillness",
    requiredElements: ["extreme negative space", "a single focal event"],
    prohibitedElements: [...SHARED_PROHIBITED, "dense star fields", "colorful nebulae", "lens flares", "science-fiction hardware"],
    positiveInstructions: "Reduce, then reduce again. Let emptiness carry the image.",
  },
  defaultPalette: sw("cm", ["#05060a", "#10142a", "#262b4d", "#6b6a80", "#d8c9a3"], [
    "void",
    "midnight",
    "indigo",
    "dust violet",
    "champagne",
  ]),
};

const NOCTURNAL_NATURE: StylePreset = {
  key: "nocturnal-nature",
  name: "Nocturnal Nature",
  description: "Moonlit forests, rivers and meadows. Wildlife seen at night under quiet, natural light.",
  attributes: {
    ...ELSEWHERE_ORIGINAL.attributes,
    medium: "Nocturnal nature photography with a surreal undertone",
    lighting: "Natural moonlight from one direction; cool reflected light from water or snow; no artificial light",
    colorPhilosophy: "Deep moss, pine, charcoal and moon-silver; cool but never monochrome blue",
    subjectTreatment: "Animals behave naturally, caught mid-moment; readable silhouettes against faint light",
    emotionalCharacter: "Stillness, mystery, belonging, quiet wonder",
    requiredElements: ["moonlight", "living natural environment"],
  },
  defaultPalette: sw("nn", ["#07090a", "#18211d", "#2f3d35", "#5d6b66", "#b9c2c0"], [
    "night",
    "forest floor",
    "pine",
    "lichen gray",
    "moon silver",
  ]),
};

const ATMOSPHERIC_MONOCHROME: StylePreset = {
  key: "atmospheric-monochrome",
  name: "Atmospheric Monochrome",
  description: "Black and white images built from fog, haze and tonal layering.",
  attributes: {
    ...ELSEWHERE_ORIGINAL.attributes,
    medium: "Black and white fine-art photography",
    colorPhilosophy: "Strictly monochrome; tonal separation replaces color entirely",
    saturation: "Zero saturation",
    contrast: "Wide tonal scale from paper white to deep black, separated by layers of atmosphere",
    atmosphericDepth: "Pronounced: fog, mist and haze define every plane of depth",
    grain: "Visible silver-gelatin grain, fine and organic",
    emotionalCharacter: "Contemplation, peaceful melancholy, introspection",
    requiredElements: ["layered atmosphere", "monochrome tonality"],
  },
  defaultPalette: sw("am", ["#0a0a0a", "#2a2a2a", "#5a5a5a", "#9a9a9a", "#e4e2dc"]),
};

const SURREAL_GEOLOGICAL: StylePreset = {
  key: "surreal-geological",
  name: "Surreal Geological",
  description: "Impossible stone, sand, ice and mineral formations at monumental scale.",
  attributes: {
    ...ELSEWHERE_ORIGINAL.attributes,
    medium: "Large-format landscape photography of impossible geology",
    exposure: "Darker than conventional landscape work, with light grazing the forms to reveal texture",
    lighting: "Low raking light or soft overcast that reveals mineral texture and stratification",
    colorPhilosophy: "Mineral palettes: sandstone, ochre, terracotta, umber, charcoal, basalt; colors come from the rock itself",
    texture: "Hyper-real mineral texture: strata, fractures, crystalline surfaces, wind-carved grain",
    environmentalTreatment: "Folded terrain, inverted or floating formations, impossible arches and cantilevers",
    emotionalCharacter: "Awe, deep time, stillness",
    requiredElements: ["monumental geological forms", "legible material texture"],
  },
  defaultPalette: sw("sg", ["#120e0b", "#3a2a1f", "#7a5136", "#b08158", "#d8c3a0"], [
    "basalt",
    "umber",
    "terracotta",
    "ochre",
    "sandstone",
  ]),
};

const QUIET_ARCHITECTURAL: StylePreset = {
  key: "quiet-architectural",
  name: "Quiet Architectural",
  description: "Solitary built forms such as stairs, windows, doors and chapels placed in impossible natural settings.",
  attributes: {
    ...ELSEWHERE_ORIGINAL.attributes,
    medium: "Architectural fine-art photography",
    renderingStyle: "Precise, restrained architectural photography; true verticals; materials rendered honestly",
    lighting: "A single soft light source, sometimes a lit window or doorway as the only warm accent",
    colorPhilosophy: "Stone, plaster, weathered wood and the surrounding natural palette; one optional warm accent",
    compositionPhilosophy: "Strong geometry and symmetry or deliberate asymmetry; generous emptiness around the structure",
    subjectTreatment: "The structure is the subject; people, if present, are tiny and incidental",
    emotionalCharacter: "Solitude, belonging, mystery, introspection",
    requiredElements: ["a single architectural element", "clean geometry"],
  },
  defaultPalette: sw("qa", ["#0c0c0d", "#26262a", "#55524d", "#a59e92", "#e3c48f"], [
    "shadow",
    "slate",
    "weathered stone",
    "plaster",
    "lamplight",
  ]),
};

export const STYLE_PRESETS: StylePreset[] = [
  ELSEWHERE_ORIGINAL,
  COSMIC_MINIMALISM,
  NOCTURNAL_NATURE,
  ATMOSPHERIC_MONOCHROME,
  SURREAL_GEOLOGICAL,
  QUIET_ARCHITECTURAL,
];
