/**
 * Controlled vocabularies shared by the UI, prompt engine, validation and explore engine.
 * Each entry has a stable key (stored) and a human label (displayed).
 */

export type Option<K extends string = string> = { key: K; label: string; hint?: string };

function opts<const K extends string>(list: readonly (readonly [K, string] | readonly [K, string, string])[]) {
  return list.map(([key, label, hint]) => ({ key, label, hint })) as Option<K>[];
}

export const CHARACTER_KINDS = [
  "none",
  "adult",
  "child",
  "elderly",
  "traveler",
  "astronaut",
  "hiker",
  "cat",
  "fox",
  "deer",
  "rabbit",
  "bird",
  "wolf",
  "horse",
  "whale",
  "butterfly",
  "insect",
  "silhouette",
  "object",
] as const;
export type CharacterKind = (typeof CHARACTER_KINDS)[number];

export const CHARACTER_OPTIONS = opts<CharacterKind>([
  ["none", "No character", "Let the environment be the subject"],
  ["adult", "Adult"],
  ["child", "Child"],
  ["elderly", "Elderly person"],
  ["traveler", "Traveler"],
  ["astronaut", "Astronaut"],
  ["hiker", "Hiker"],
  ["cat", "Cat"],
  ["fox", "Fox"],
  ["deer", "Deer"],
  ["rabbit", "Rabbit"],
  ["bird", "Bird"],
  ["wolf", "Wolf"],
  ["horse", "Horse"],
  ["whale", "Whale"],
  ["butterfly", "Butterfly"],
  ["insect", "Insect"],
  ["silhouette", "Abstract silhouette"],
  ["object", "Inanimate object"],
]);

/** Natural-language nouns used by the prompt engine. */
export const CHARACTER_NOUNS: Record<CharacterKind, [singular: string, plural: string]> = {
  none: ["", ""],
  adult: ["adult figure", "adult figures"],
  child: ["child", "children"],
  elderly: ["elderly person", "elderly people"],
  traveler: ["traveler", "travelers"],
  astronaut: ["astronaut", "astronauts"],
  hiker: ["hiker", "hikers"],
  cat: ["cat", "cats"],
  fox: ["fox", "foxes"],
  deer: ["deer", "deer"],
  rabbit: ["rabbit", "rabbits"],
  bird: ["bird", "birds"],
  wolf: ["wolf", "wolves"],
  horse: ["horse", "horses"],
  whale: ["whale", "whales"],
  butterfly: ["butterfly", "butterflies"],
  insect: ["insect", "insects"],
  silhouette: ["abstract silhouette", "abstract silhouettes"],
  object: ["object", "objects"],
};

export const HUMAN_KINDS: CharacterKind[] = ["adult", "child", "elderly", "traveler", "astronaut", "hiker", "silhouette"];

export const DIRECTIONS = [
  "unspecified",
  "facing-viewer",
  "facing-away",
  "profile-left",
  "profile-right",
  "three-quarter",
  "looking-up",
  "looking-down",
] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const DIRECTION_OPTIONS = opts<Direction>([
  ["unspecified", "Unspecified"],
  ["facing-viewer", "Facing viewer"],
  ["facing-away", "Facing away"],
  ["profile-left", "Profile, left"],
  ["profile-right", "Profile, right"],
  ["three-quarter", "Three-quarter"],
  ["looking-up", "Looking up"],
  ["looking-down", "Looking down"],
]);

export const MOVEMENTS = [
  "still",
  "walking",
  "running",
  "leaping",
  "flying",
  "floating",
  "swimming",
  "climbing",
  "drifting",
  "resting",
] as const;
export type Movement = (typeof MOVEMENTS)[number];
export const MOVEMENT_OPTIONS = opts<Movement>(MOVEMENTS.map((m) => [m, m[0].toUpperCase() + m.slice(1)] as const));

export const RELATIONSHIPS = [
  "dwarfed",
  "observing",
  "traversing",
  "sheltered",
  "interacting",
  "emerging",
  "integrated",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];
export const RELATIONSHIP_OPTIONS = opts<Relationship>([
  ["dwarfed", "Dwarfed by it", "The environment overwhelms the subject"],
  ["observing", "Observing it", "Quietly witnessing the phenomenon"],
  ["traversing", "Traversing it", "Moving through the landscape"],
  ["sheltered", "Sheltered within", "Held or protected by the environment"],
  ["interacting", "Interacting", "Touching or reaching toward it"],
  ["emerging", "Emerging from", "Appearing out of the environment"],
  ["integrated", "Part of it", "Nearly indistinguishable from the place"],
]);

export const ANCHORS = [
  "upper-left",
  "upper-center",
  "upper-right",
  "middle-left",
  "center",
  "middle-right",
  "lower-left",
  "lower-center",
  "lower-right",
  "custom",
] as const;
export type Anchor = (typeof ANCHORS)[number];

export const ANCHOR_POINTS: Record<Exclude<Anchor, "custom">, [number, number]> = {
  "upper-left": [1 / 6, 1 / 6],
  "upper-center": [0.5, 1 / 6],
  "upper-right": [5 / 6, 1 / 6],
  "middle-left": [1 / 6, 0.5],
  center: [0.5, 0.5],
  "middle-right": [5 / 6, 0.5],
  "lower-left": [1 / 6, 5 / 6],
  "lower-center": [0.5, 5 / 6],
  "lower-right": [5 / 6, 5 / 6],
};

export const COMPOSITION_PRESETS = [
  "extreme-negative-space",
  "symmetrical",
  "asymmetrical",
  "rule-of-thirds",
  "central-isolation",
  "diagonal-movement",
  "radial",
  "vertical-emphasis",
  "horizontal-emphasis",
  "foreground-framing",
  "layered-depth",
  "overhead",
  "worms-eye",
  "birds-eye",
  "horizonless",
  "impossible-perspective",
] as const;
export type CompositionPreset = (typeof COMPOSITION_PRESETS)[number];

export const COMPOSITION_PRESET_OPTIONS = opts<CompositionPreset>([
  ["extreme-negative-space", "Extreme negative space"],
  ["symmetrical", "Symmetrical"],
  ["asymmetrical", "Asymmetrical"],
  ["rule-of-thirds", "Rule of thirds"],
  ["central-isolation", "Central isolation"],
  ["diagonal-movement", "Diagonal movement"],
  ["radial", "Radial"],
  ["vertical-emphasis", "Vertical emphasis"],
  ["horizontal-emphasis", "Horizontal emphasis"],
  ["foreground-framing", "Foreground framing"],
  ["layered-depth", "Layered depth"],
  ["overhead", "Overhead perspective"],
  ["worms-eye", "Worm's-eye perspective"],
  ["birds-eye", "Bird's-eye perspective"],
  ["horizonless", "Horizonless"],
  ["impossible-perspective", "Impossible perspective"],
]);

export const COMPOSITION_PRESET_LANGUAGE: Record<CompositionPreset, string> = {
  "extreme-negative-space":
    "extreme negative space, with the vast majority of the frame left quiet and empty so the subject feels profoundly alone",
  symmetrical: "a calm, symmetrical arrangement balanced around the vertical axis",
  asymmetrical: "an asymmetrical balance, with visual weight deliberately offset against open space",
  "rule-of-thirds": "a rule-of-thirds arrangement, with key elements resting on the thirds intersections",
  "central-isolation": "central isolation, the subject alone at the heart of the frame surrounded by emptiness",
  "diagonal-movement": "strong diagonal movement leading the eye across the frame",
  radial: "a radial composition, with forms converging toward or radiating from a single point",
  "vertical-emphasis": "strong vertical emphasis, towering forms stretching through the height of the frame",
  "horizontal-emphasis": "strong horizontal emphasis, long calm bands stretching across the frame",
  "foreground-framing": "natural foreground framing, dark nearby forms enclosing a distant view",
  "layered-depth": "layered depth, distinct foreground, middle ground and background planes receding into atmosphere",
  overhead: "an overhead perspective looking straight down onto the scene",
  "worms-eye": "a worm's-eye perspective from very low ground, looking steeply upward",
  "birds-eye": "a bird's-eye perspective from high above, the landscape spread out below",
  horizonless: "a horizonless composition with no visible horizon line, space continuing beyond every edge",
  "impossible-perspective":
    "an impossible perspective in which planes, horizons and vanishing points quietly contradict each other",
};

export const CAMERA_ANGLES = ["eye-level", "low", "high", "overhead", "worms-eye", "birds-eye"] as const;
export type CameraAngle = (typeof CAMERA_ANGLES)[number];
export const CAMERA_ANGLE_OPTIONS = opts<CameraAngle>([
  ["eye-level", "Eye level"],
  ["low", "Low angle"],
  ["high", "High angle"],
  ["overhead", "Overhead"],
  ["worms-eye", "Worm's-eye"],
  ["birds-eye", "Bird's-eye"],
]);

export const TIMES_OF_DAY = [
  "unspecified",
  "pre-dawn",
  "dawn",
  "morning",
  "midday",
  "afternoon",
  "golden-hour",
  "dusk",
  "blue-hour",
  "night",
  "deep-night",
  "timeless",
] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];
export const TIME_OPTIONS = opts<TimeOfDay>([
  ["unspecified", "Unspecified"],
  ["pre-dawn", "Pre-dawn"],
  ["dawn", "Dawn"],
  ["morning", "Morning"],
  ["midday", "Midday"],
  ["afternoon", "Afternoon"],
  ["golden-hour", "Golden hour"],
  ["dusk", "Dusk"],
  ["blue-hour", "Blue hour"],
  ["night", "Night"],
  ["deep-night", "Deep night"],
  ["timeless", "Timeless, unplaceable"],
]);

export const PALETTE_MODES = [
  "material",
  "style",
  "reference",
  "custom",
  "monochromatic",
  "complementary",
  "analogous",
  "duotone",
  "near-monochromatic",
] as const;
export type PaletteMode = (typeof PALETTE_MODES)[number];
export const PALETTE_MODE_OPTIONS = opts<PaletteMode>([
  ["material", "Material-inspired", "Derived from the scene's materials and environment"],
  ["style", "Style DNA default"],
  ["reference", "From reference image"],
  ["custom", "Custom"],
  ["monochromatic", "Monochromatic"],
  ["complementary", "Complementary"],
  ["analogous", "Analogous"],
  ["duotone", "Duotone"],
  ["near-monochromatic", "Near-monochromatic"],
]);

export const REFERENCE_ROLES = [
  "style",
  "composition",
  "lighting",
  "color",
  "texture",
  "subject",
  "environment",
] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];
export const REFERENCE_ROLE_OPTIONS = opts<ReferenceRole>([
  ["style", "Primary style"],
  ["composition", "Composition"],
  ["lighting", "Lighting"],
  ["color", "Color"],
  ["texture", "Texture"],
  ["subject", "Subject"],
  ["environment", "Environment"],
]);

export const ASPECT_RATIOS = ["1:1", "4:5", "3:4", "2:3", "9:16", "5:4", "4:3", "3:2", "16:9", "21:9"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export const ASPECT_OPTIONS = opts<AspectRatio>([
  ["1:1", "Square 1:1"],
  ["4:5", "Portrait 4:5"],
  ["3:4", "Portrait 3:4"],
  ["2:3", "Portrait 2:3"],
  ["9:16", "Tall 9:16"],
  ["5:4", "Landscape 5:4"],
  ["4:3", "Landscape 4:3"],
  ["3:2", "Landscape 3:2"],
  ["16:9", "Wide 16:9"],
  ["21:9", "Panoramic 21:9"],
]);

export const QUALITIES = ["auto", "low", "medium", "high", "xhigh", "max"] as const;
export type Quality = (typeof QUALITIES)[number];

export const FORMATS = ["png", "webp", "jpeg"] as const;
export type ImageFormat = (typeof FORMATS)[number];

export const BACKGROUNDS = ["auto", "opaque", "transparent"] as const;
export type BackgroundMode = (typeof BACKGROUNDS)[number];

export const REVIEW_STATUSES = ["unreviewed", "accepted", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const JOB_STATUSES = ["queued", "generating", "processing", "completed", "failed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const GENERATION_KINDS = ["generate", "variation", "refine", "import"] as const;
export type GenerationKind = (typeof GENERATION_KINDS)[number];

export const REVIEW_CRITERIA = [
  "visualConsistency",
  "composition",
  "subjectScale",
  "colorAccuracy",
  "lighting",
  "texture",
  "negativeSpace",
  "materialRealism",
  "emotionalTone",
  "originality",
  "restraint",
] as const;
export type ReviewCriterion = (typeof REVIEW_CRITERIA)[number];
export const REVIEW_CRITERIA_OPTIONS = opts<ReviewCriterion>([
  ["visualConsistency", "Visual consistency"],
  ["composition", "Composition quality"],
  ["subjectScale", "Subject scale"],
  ["colorAccuracy", "Color accuracy"],
  ["lighting", "Lighting consistency"],
  ["texture", "Texture consistency"],
  ["negativeSpace", "Negative space"],
  ["materialRealism", "Material realism"],
  ["emotionalTone", "Emotional tone"],
  ["originality", "Originality"],
  ["restraint", "Restraint (no unnecessary detail)"],
]);

export const EMOTIONAL_TONES = [
  "quiet wonder",
  "solitude",
  "contemplation",
  "mystery",
  "peaceful melancholy",
  "stillness",
  "belonging",
  "awe",
  "introspection",
  "transcendence",
  "tenderness",
  "anticipation",
] as const;

export const ATMOSPHERES = [
  "low drifting fog",
  "thin high mist",
  "fine suspended dust",
  "still, perfectly clear air",
  "soft falling snow",
  "fine rain hanging in the air",
  "sea haze",
  "smoke-like low cloud",
  "heavy humid air",
  "frozen, crystalline air",
  "pollen drifting in still light",
] as const;

export const NATURAL_ELEMENTS = [
  "water",
  "stone",
  "moss",
  "ice",
  "sand",
  "cloud",
  "fog",
  "leaves",
  "flowers",
  "roots",
  "salt",
  "obsidian",
  "snow",
  "light",
  "seed heads",
  "coral",
  "lichen",
  "fungi",
] as const;

export const MATERIALS = [
  "weathered granite",
  "wet basalt",
  "glacial ice",
  "fine wind-rippled sand",
  "translucent petals",
  "velvet moss",
  "polished river stone",
  "brittle autumn leaves",
  "sea glass",
  "salt crust",
  "volcanic glass",
  "soft lichen",
  "frost",
  "pale driftwood",
  "dense fog",
  "thin paper bark",
] as const;

/** Free-text scene fields that offer ideas. */
export const IDEA_FIELDS = [
  "title",
  "description",
  "freeDirection",
  "subjectLabel",
  "action",
  "pose",
  "clothing",
  "environment",
  "phenomenon",
  "naturalElement",
  "materials",
  "lighting",
  "atmosphere",
  "emotionalTone",
] as const;
export type IdeaField = (typeof IDEA_FIELDS)[number];
