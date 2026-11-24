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
  name: "Elsewhere Photographic",
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

/**
 * Written from the five reference originals of Elsewhere: Volume I. It describes
 * the look (painterly, grain-textured, one glowing light, tiny silhouettes, vast
 * darkness) and leaves hue and subject to each scene, so the aesthetic can be
 * recreated in any colour or with any subject.
 */
export const ELSEWHERE_VOLUME_ONE: StylePreset = {
  key: "elsewhere-volume-i",
  name: "Elsewhere Volume I",
  description:
    "The look of the Volume I originals: soft painterly images under a fine, even grain, one glowing light in vast darkness, and tiny silhouettes dwarfed by impossible scale. Colour and subject come from each scene.",
  attributes: {
    medium: "Painterly digital illustration with the restraint of a fine-art print. Not a photograph.",
    renderingStyle:
      "Soft, airbrushed forms built from smooth tonal gradients; few hard edges; detail is suggested rather than described; never photographic or hyper-real",
    photographic:
      "No photographic sharpness, lens effects or micro-detail. Forms read as simplified painted shapes",
    exposure:
      "Very dark and low-key: most of the frame sits in near-black, with a single area of glowing light",
    contrast: "Soft gradation within the light, falling away smoothly into darkness; no clipped highlights",
    shadowDepth: "Shadows dissolve into near-black and envelop most of the frame",
    lighting:
      "One glowing light source, such as a window, a moon's rim, a low sun or a horizon glow, casting broad, soft beams through haze. Light blooms and scatters; the subject is often rim-lit or silhouetted against it",
    colorPhilosophy:
      "A near-monochromatic palette: one hue family plus near-black, with highlights as paler tints of that hue. The hue comes from the scene's palette; keep the image essentially two-tone",
    saturation: "Muted and dusky overall; the glow can carry slightly richer colour than the surrounding darkness",
    texture:
      "An even, fine stippled grain over the entire image, like textured paper or mezzotint, visible in both the darks and the lights",
    grain: "Pronounced, uniform painterly grain; never clean, smooth digital surfaces",
    atmosphericDepth: "Dense haze and soft mist; depth is shown by forms fading into glow and darkness",
    compositionPhilosophy:
      "Vast negative space, a single monumental element and a tiny subject placed low in the frame; strong diagonals of light; tall vertical frames",
    subjectTreatment: "Tiny, flat silhouettes with no interior detail, often rim-lit by the light source",
    environmentalTreatment:
      "Simple, monumental shapes such as hills, sea, sky, a single window or a moon; impossibly scaled natural elements",
    emotionalCharacter: "Solitude, quiet wonder, stillness, awe, peaceful melancholy",
    requiredElements: ["one glowing light source", "an even, fine grain over the whole image", "vast dark negative space"],
    prohibitedElements: [
      ...SHARED_PROHIBITED,
      "photorealism",
      "crisp photographic detail",
      "hard-edged digital rendering",
      "busy or cluttered detail",
      "multiple light sources",
      "saturated neon",
    ],
    positiveInstructions: "Keep it simple, soft and dark. Let one shape and one light carry the image.",
    negativeConstraints: "Avoid realistic photography, sharp textures, plastic CGI and cluttered scenes.",
  },
  defaultPalette: sw("v1", ["#0b0a14", "#1e1a3a", "#3b2f6b", "#8b6fc0", "#d9c2f0"], [
    "near black",
    "deep indigo",
    "violet",
    "lavender",
    "pale lilac",
  ]),
};

/*
 * The themed presets share the Volume I medium (painterly, grain-textured, one glow,
 * vast darkness) and differ in subject matter, light and colour. Elsewhere
 * Photographic is the one deliberately photographic option.
 */
const PAINTERLY = ELSEWHERE_VOLUME_ONE.attributes;

const COSMIC_MINIMALISM: StylePreset = {
  key: "cosmic-minimalism",
  name: "Cosmic Minimalism",
  description: "Vast, nearly empty cosmic spaces reduced to a few painted elements. Silence at astronomical scale, in the Volume I medium.",
  attributes: {
    ...PAINTERLY,
    medium: "Painterly digital illustration with a cosmic sensibility and the restraint of a fine-art print. Not a photograph.",
    exposure: "Deep blacks dominate; a single field of soft, glowing light provides the only real tonal event",
    lighting: "A single distant glow such as a planet's rim, a low moon or a faint aurora, rendered as soft painted light; nothing else glows",
    colorPhilosophy: "Midnight blue, indigo and muted champagne; occasional warm dust tones. Very few hues per frame",
    compositionPhilosophy: "Extreme negative space; one or two elements; strong horizontal calm or central isolation",
    environmentalTreatment: "Space and landscape merge; horizons dissolve into the cosmos; scale is planetary, shapes simple and monumental",
    emotionalCharacter: "Awe, transcendence, solitude, stillness",
    requiredElements: ["extreme negative space", "a single focal glow", "an even, fine grain over the whole image"],
    prohibitedElements: [...PAINTERLY.prohibitedElements, "dense star fields", "colorful nebulae", "lens flares", "science-fiction hardware"],
    positiveInstructions: "Reduce, then reduce again. Let emptiness and one soft glow carry the image.",
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
  description: "Moonlit forests, rivers and meadows, and wildlife at night, painted softly under one quiet light.",
  attributes: {
    ...PAINTERLY,
    medium: "Painterly nocturne of the natural world with the restraint of a fine-art print. Not a photograph.",
    lighting: "Soft painted moonlight from one direction; cool reflected glow from water or snow; no artificial light",
    colorPhilosophy: "Deep moss, pine, charcoal and moon-silver; cool but never monochrome blue",
    subjectTreatment: "Animals caught mid-moment as small, flat silhouettes against faint light",
    environmentalTreatment: "Forests, rivers and meadows reduced to simple layered shapes receding into darkness",
    emotionalCharacter: "Stillness, mystery, belonging, quiet wonder",
    requiredElements: ["moonlight", "a living natural environment", "an even, fine grain over the whole image"],
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
  description: "Black and white images built from fog, haze and tonal layering, like a mezzotint or graphite print.",
  attributes: {
    ...PAINTERLY,
    medium: "Monochrome painterly illustration in the manner of a mezzotint or graphite print. Not a photograph.",
    colorPhilosophy: "Strictly monochrome; tonal separation replaces color entirely",
    saturation: "Zero saturation",
    contrast: "Wide tonal scale from paper white to deep black, separated by soft layers of atmosphere",
    atmosphericDepth: "Pronounced: fog, mist and haze define every plane of depth",
    grain: "Visible, even mezzotint or graphite grain across the whole image",
    emotionalCharacter: "Contemplation, peaceful melancholy, introspection",
    requiredElements: ["layered atmosphere", "monochrome tonality", "an even, fine grain over the whole image"],
  },
  defaultPalette: sw("am", ["#0a0a0a", "#2a2a2a", "#5a5a5a", "#9a9a9a", "#e4e2dc"]),
};

const SURREAL_GEOLOGICAL: StylePreset = {
  key: "surreal-geological",
  name: "Surreal Geological",
  description: "Impossible stone, sand, ice and mineral formations at monumental scale, painted in simple, grain-textured forms.",
  attributes: {
    ...PAINTERLY,
    medium: "Painterly illustration of impossible geology with the restraint of a fine-art print. Not a photograph.",
    exposure: "Dark and low-key, with a low glow grazing the forms to reveal their shape",
    lighting: "Low raking glow or soft overcast light that picks out simplified strata and edges",
    colorPhilosophy: "Mineral palettes: sandstone, ochre, terracotta, umber, charcoal, basalt; colors come from the rock itself",
    texture: "Simplified painterly mineral texture: strata and fractures suggested by tone and an even grain, never hyper-real",
    environmentalTreatment: "Folded terrain, inverted or floating formations, impossible arches and cantilevers, reduced to monumental shapes",
    emotionalCharacter: "Awe, deep time, stillness",
    requiredElements: ["monumental geological forms", "an even, fine grain over the whole image"],
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
  description: "Solitary built forms such as stairs, windows, doors and chapels in impossible natural settings, painted simply and softly.",
  attributes: {
    ...PAINTERLY,
    medium: "Painterly illustration of solitary architecture with the restraint of a fine-art print. Not a photograph.",
    renderingStyle: "Clean, simplified painted geometry with soft edges; true verticals; materials suggested by tone rather than detail",
    lighting: "A single soft glow, often a lit window or doorway as the only warm accent",
    colorPhilosophy: "Stone, plaster, weathered wood and the surrounding natural palette; one optional warm accent",
    compositionPhilosophy: "Strong geometry and symmetry or deliberate asymmetry; generous emptiness around the structure",
    subjectTreatment: "The structure is the subject; people, if present, are tiny flat silhouettes",
    emotionalCharacter: "Solitude, belonging, mystery, introspection",
    requiredElements: ["a single architectural element", "clean geometry", "an even, fine grain over the whole image"],
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
  ELSEWHERE_VOLUME_ONE,
  COSMIC_MINIMALISM,
  NOCTURNAL_NATURE,
  ATMOSPHERIC_MONOCHROME,
  SURREAL_GEOLOGICAL,
  QUIET_ARCHITECTURAL,
  ELSEWHERE_ORIGINAL,
];

/** Presets that were photographic before bootstrap v3, with the name they had then. */
export const REPAINTED_PRESET_KEYS = ["cosmic-minimalism", "nocturnal-nature", "atmospheric-monochrome", "surreal-geological", "quiet-architectural"] as const;
export const PHOTOGRAPHIC_PRESET = { key: "elsewhere-original", previousName: "Elsewhere Original" } as const;
