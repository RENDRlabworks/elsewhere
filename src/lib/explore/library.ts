import type { CharacterKind } from "@/lib/domain/vocab";

/**
 * Creative source material for the exploration engine.
 * Phenomena are grouped by the kind of impossibility they introduce so the
 * engine can vary the *relationship* rather than always enlarging an object.
 */

export type PhenomenonKind = "scale" | "gravity" | "perspective" | "time" | "space" | "material" | "inversion";

export const PHENOMENA: { text: string; kind: PhenomenonKind; element: string; material: string }[] = [
  { text: "an inverted mountain range hanging from the sky, its peaks pointing down toward the land", kind: "inversion", element: "stone", material: "weathered granite" },
  { text: "a floating ocean suspended above the land, its underside lit softly from below", kind: "gravity", element: "water", material: "dark seawater" },
  { text: "a waterfall frozen mid-fall, every droplet suspended motionless in the air", kind: "time", element: "water", material: "suspended droplets" },
  { text: "an enormous translucent flower rising above the landscape like a cathedral", kind: "scale", element: "flowers", material: "translucent petals" },
  { text: "a colossal insect resting quietly on the land, as large as a hill", kind: "scale", element: "leaves", material: "iridescent chitin dulled by dust" },
  { text: "a landscape where gravity runs sideways, trees and rivers growing from a vertical horizon", kind: "gravity", element: "roots", material: "earth and moss" },
  { text: "terrain that folds upward and over itself like a turning page", kind: "perspective", element: "stone", material: "layered sediment" },
  { text: "a perfect reflection in still water that shows a different world from the one above", kind: "perspective", element: "water", material: "black mirror-still water" },
  { text: "a sky fractured like cracked glass, revealing another sky behind it", kind: "space", element: "light", material: "fractured sky" },
  { text: "raindrops suspended in the air, each holding a tiny reflected landscape", kind: "time", element: "water", material: "suspended rain" },
  { text: "an infinite forest of identical trunks receding in every direction without end", kind: "space", element: "roots", material: "pale bark" },
  { text: "islands of rock and soil floating in the air, trailing roots and waterfalls", kind: "gravity", element: "stone", material: "rock and hanging roots" },
  { text: "a miniature world contained inside a seed head, a dandelion clock holding a tiny landscape", kind: "scale", element: "seed heads", material: "fine seed filaments" },
  { text: "an ocean that merges seamlessly with space at the horizon, waves becoming stars", kind: "space", element: "water", material: "dark water and starlight" },
  { text: "clouds behaving like solid objects, resting on the ground like boulders", kind: "material", element: "cloud", material: "dense cloud" },
  { text: "a single leaf so large it forms a canopy over the valley", kind: "scale", element: "leaves", material: "veined leaf tissue" },
  { text: "a moon resting low enough to touch the hills, its surface texture fully visible", kind: "scale", element: "stone", material: "lunar dust" },
  { text: "a staircase of stone ascending into darkness with no structure supporting it", kind: "gravity", element: "stone", material: "worn limestone" },
  { text: "a wave that has stopped mid-crest and become as still as glass", kind: "time", element: "water", material: "glass-still water" },
  { text: "a meadow growing on the underside of a cloud bank", kind: "inversion", element: "flowers", material: "wild grass and cloud" },
  { text: "a river of fog flowing uphill through a valley", kind: "gravity", element: "fog", material: "dense fog" },
  { text: "a desert where the dunes are made of slowly drifting snow", kind: "material", element: "snow", material: "powder snow" },
  { text: "an enormous sphere of polished mineral resting impossibly on a single point", kind: "gravity", element: "stone", material: "polished mineral" },
  { text: "bioluminescent tide pools on the surface of a cliff face, the sea turned vertical", kind: "perspective", element: "water", material: "wet basalt" },
  { text: "a field of salt crystals growing into monumental translucent towers", kind: "material", element: "salt", material: "salt crust" },
  { text: "a forest canopy seen from inside, extending upward for miles", kind: "scale", element: "leaves", material: "dense green canopy" },
  { text: "a horizon that curves upward on both sides, as if the land were the inside of a sphere", kind: "perspective", element: "stone", material: "rolling earth" },
  { text: "a frozen lake holding a whole night sky trapped beneath its ice", kind: "space", element: "ice", material: "black ice" },
  { text: "a herd of animals walking across the surface of a calm sea", kind: "gravity", element: "water", material: "mirror-still sea" },
  { text: "a mushroom grove where the caps are as tall as cathedrals and softly translucent", kind: "scale", element: "fungi", material: "translucent fungal tissue" },
];

export const ENVIRONMENTS = [
  "an ancient pine forest at the edge of a cliff",
  "a vast salt flat stretching to an invisible horizon",
  "a submerged valley where an old forest stands in still water",
  "a glacial plateau beneath a towering wall of blue ice",
  "an endless field of tall dry grass",
  "a black volcanic coastline",
  "a fog-filled canyon of red sandstone",
  "a dark meadow of wildflowers in a high mountain basin",
  "a bare hillside under an immense sky",
  "a moss-covered ravine of ancient trees",
  "a frozen sea of pressure ridges",
  "a desert of wind-carved sandstone pillars",
  "the floor of an enormous cave opening to the sky",
  "a shallow tidal flat reflecting the sky",
  "a birch forest in fresh snow",
  "the rim of a crater lake",
  "a lone island of basalt in a calm sea",
  "an autumn valley thick with copper foliage",
  "a high alpine ridge above a sea of cloud",
  "a field of standing stones in heather",
];

export const ACTIONS: Record<"human" | "quadruped" | "flyer" | "swimmer" | "small" | "object" | "none", string[]> = {
  human: [
    "standing still, looking up",
    "walking slowly toward the phenomenon",
    "sitting quietly with knees drawn up",
    "reaching out a hand",
    "holding a small lantern at their side",
    "pausing mid-step",
    "lying on their back, gazing upward",
    "kneeling at the water's edge",
    "climbing a gentle slope",
    "standing with arms at their sides, utterly still",
  ],
  quadruped: [
    "pausing mid-step, head raised",
    "leaping between rocks",
    "sitting upright, watching",
    "walking slowly across the open ground",
    "drinking from still water",
    "looking back over its shoulder",
    "curled asleep",
    "standing alert, ears forward",
  ],
  flyer: ["flying low across the frame", "gliding in a long arc", "hovering motionless", "taking off into the air", "perched, wings half open"],
  swimmer: ["drifting slowly through the air", "breaching silently", "gliding past in profile", "turning in a slow arc"],
  small: ["resting on a single stem", "crawling along an edge", "suspended in the light", "perched at the very tip"],
  object: ["resting alone", "half-buried", "standing upright", "floating just above the ground", "tilted at an impossible angle"],
  none: [""],
};

export function actionGroup(kind: CharacterKind): keyof typeof ACTIONS {
  if (["adult", "child", "elderly", "traveler", "astronaut", "hiker", "silhouette"].includes(kind)) return "human";
  if (["cat", "fox", "deer", "rabbit", "wolf", "horse"].includes(kind)) return "quadruped";
  if (kind === "bird") return "flyer";
  if (kind === "whale") return "swimmer";
  if (["butterfly", "insect"].includes(kind)) return "small";
  if (kind === "object") return "object";
  return "none";
}

export const OBJECTS = [
  "an old wooden chair",
  "a lit window frame",
  "a small rowing boat",
  "an open door",
  "a red umbrella",
  "a lighthouse",
  "a solitary streetlamp",
  "a grand piano",
  "a telephone booth",
  "a bed with white sheets",
];

export const LIGHTING = [
  "soft moonlight from behind the subject",
  "a single shaft of light breaking through cloud",
  "cold reflected light from snow",
  "last light grazing the horizon",
  "diffuse light from a low, overcast sky",
  "a soft glow from below the horizon",
  "backlight through thin fog",
  "a single warm light source in an otherwise dark scene",
  "faint starlight and the afterglow of dusk",
  "pale dawn light seeping across the land",
];

export const SCALE_RELATIONSHIPS = [
  { text: "the subject is a tiny speck against the vast environment", height: 1.5 },
  { text: "the subject is small, clearly dwarfed by the phenomenon", height: 4 },
  { text: "the subject is modest in size, the environment still dominant", height: 10 },
  { text: "the subject is close and present, the impossibility behind it", height: 30 },
  { text: "the subject is barely visible, discovered on second look", height: 0.8 },
];

export const TONES = [
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
];

export const ATMOSPHERE_OPTIONS = [
  "low drifting fog",
  "thin high mist",
  "fine suspended dust catching the light",
  "perfectly still, clear air",
  "soft falling snow",
  "sea haze softening the distance",
  "heavy, humid air",
  "frozen, crystalline air",
  "pollen drifting in still light",
];

export const TITLE_NOUNS = [
  "Hour",
  "Tide",
  "Weight",
  "Silence",
  "Migration",
  "Keeper",
  "Garden",
  "Window",
  "Threshold",
  "Archive",
  "Descent",
  "Lantern",
  "Drift",
  "Return",
  "Harbor",
  "Orbit",
  "Vigil",
  "Hollow",
];
export const TITLE_ADJECTIVES = [
  "Last",
  "Quiet",
  "Sleeping",
  "Forgotten",
  "Unwritten",
  "Inverted",
  "Patient",
  "Distant",
  "Second",
  "Borrowed",
  "Slow",
  "Suspended",
  "Hidden",
  "Unfinished",
];
