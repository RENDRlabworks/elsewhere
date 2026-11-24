import type { CharacterKind } from "@/lib/domain/vocab";
import { ATMOSPHERES, EMOTIONAL_TONES, MATERIALS, NATURAL_ELEMENTS } from "@/lib/domain/vocab";
import { ACTIONS, actionGroup, ATMOSPHERE_OPTIONS, ENVIRONMENTS, LIGHTING, OBJECTS, TONES } from "./library";

/**
 * Grouped suggestions for the Studio's dropdown fields. Written for Elsewhere's world:
 * quiet, natural, a little impossible. The built-in idea pools draw from the same lists.
 */

export type SuggestionGroup = { label: string; items: readonly string[] };

/** Every item once, in order, keeping the first group an item appears in. */
function dedupe(groups: SuggestionGroup[]): SuggestionGroup[] {
  const seen = new Set<string>();
  return groups
    .map((g) => ({ label: g.label, items: g.items.filter((i) => !seen.has(i.toLowerCase()) && seen.add(i.toLowerCase())) }))
    .filter((g) => g.items.length);
}

export const flatten = (groups: readonly SuggestionGroup[]) => groups.flatMap((g) => g.items);

export const ENVIRONMENT_SUGGESTIONS = dedupe([
  {
    label: "Forest and woodland",
    items: [
      "an ancient pine forest at the edge of a cliff",
      "a moss-covered ravine of ancient trees",
      "a birch forest in fresh snow",
      "an autumn valley thick with copper foliage",
      "a forest of bare white trunks standing in fog",
      "a flooded forest of black, still water",
      "a clearing ringed by enormous cedars",
      "an orchard of leafless trees in winter",
      "a redwood forest at first light",
      "a forest floor carpeted in ferns",
      "a bamboo grove in perfectly still air",
      "a mangrove maze at low tide",
      "a burnt forest of charcoal trunks and new green shoots",
      "a single path through a dense, dark wood",
    ],
  },
  {
    label: "Mountain and highland",
    items: [
      "a high alpine ridge above a sea of cloud",
      "a glacial plateau beneath a towering wall of blue ice",
      "a dark meadow of wildflowers in a high mountain basin",
      "the rim of a crater lake",
      "a bare hillside under an immense sky",
      "a scree slope beneath jagged grey peaks",
      "a mountain pass buried in deep snow",
      "a volcanic caldera filled with slow mist",
      "a lone summit rising above the clouds",
      "terraced hills shrouded in fog",
      "a high moorland of heather and scattered stone",
      "a narrow ridge falling away on both sides into cloud",
    ],
  },
  {
    label: "Water and coast",
    items: [
      "a black volcanic coastline",
      "a shallow tidal flat reflecting the sky",
      "a lone island of basalt in a calm sea",
      "a submerged valley where an old forest stands in still water",
      "a pebble beach at the edge of a grey sea",
      "sea stacks rising from a glassy ocean",
      "a still lake perfectly mirroring the sky",
      "a river delta braided across silver mudflats",
      "a waterfall pouring into a fog-filled gorge",
      "the open ocean, nothing but water to the horizon",
      "a fjord between sheer, dark cliffs",
      "a lagoon of milky turquoise water",
      "a quiet harbour at low tide, boats resting on the sand",
      "a long sandbar disappearing into the sea",
      "the shore of a lake at night, the water black and still",
      "a reed marsh threaded with narrow channels",
    ],
  },
  {
    label: "Desert and plain",
    items: [
      "a vast salt flat stretching to an invisible horizon",
      "an endless field of tall dry grass",
      "a desert of wind-carved sandstone pillars",
      "a fog-filled canyon of red sandstone",
      "a field of standing stones in heather",
      "rolling sand dunes under a pale moon",
      "a cracked, dry lakebed",
      "a prairie beneath a gathering storm",
      "a white gypsum desert",
      "a steppe of silver grass moving in the wind",
      "a field of sunflowers turned away from the light",
      "a lavender field at dusk",
      "a flooded rice terrace holding the sky",
      "a wheat field stretching to a low horizon",
      "a plain of black volcanic sand",
    ],
  },
  {
    label: "Ice and snow",
    items: [
      "a frozen sea of pressure ridges",
      "an endless snowfield with no visible horizon",
      "an ice cave of translucent blue",
      "a tundra under a low, unmoving sun",
      "a frozen waterfall hanging from a cliff",
      "an iceberg drifting in black water",
      "a snow-covered plain broken by a single tree",
      "a glacier tongue meeting a dark sea",
      "a frozen lake, its surface clear as glass",
    ],
  },
  {
    label: "Cave and underground",
    items: [
      "the floor of an enormous cave opening to the sky",
      "a sea cave lit from beneath the water",
      "a cavern lined with pale crystals",
      "a sinkhole with a small forest at its bottom",
      "an underground lake in total stillness",
      "a long tunnel of stone opening onto daylight",
    ],
  },
  {
    label: "Sky and air",
    items: [
      "above a sea of clouds at dawn",
      "inside a towering cloud",
      "a sky with no ground at all",
      "the edge of the atmosphere, the earth curving away below",
      "a field of drifting cloud islands",
    ],
  },
  {
    label: "Quiet human places",
    items: [
      "an empty road through flat farmland",
      "a lone house on a vast plain",
      "an abandoned greenhouse overgrown with vines",
      "a flooded cathedral, its floor a mirror",
      "a long pier reaching into fog",
      "a ruined stone staircase on a hillside",
      "a railway line vanishing into snow",
      "an empty swimming pool filled with fallen leaves",
      "a lighthouse on a bare rock",
      "a small rowing boat on a still lake",
      "a single streetlamp on an empty coastal road",
      "a field with a door standing alone in it",
      "a quiet rooftop above a sleeping town",
    ],
  },
  { label: "More", items: ENVIRONMENTS },
]);

export const NATURAL_ELEMENT_SUGGESTIONS = dedupe([
  { label: "Water", items: ["water", "rain", "mist", "fog", "ice", "snow", "frost", "waves", "tide", "dew", "steam", "rivers", "waterfalls", "puddles"] },
  { label: "Earth and stone", items: ["stone", "sand", "salt", "obsidian", "basalt", "chalk", "clay", "crystals", "pebbles", "boulders", "cliffs", "dunes", "ash"] },
  {
    label: "Plants",
    items: ["moss", "leaves", "flowers", "roots", "seed heads", "ferns", "grass", "reeds", "blossom", "lichen", "fungi", "vines", "bark", "pine needles", "petals", "dandelions", "wheat", "lily pads", "cherry blossom", "thistles"],
  },
  { label: "Sky and light", items: ["cloud", "light", "stars", "moonlight", "aurora", "smoke", "wind", "lightning", "sunbeams", "shadow"] },
  { label: "Sea", items: ["coral", "shells", "kelp", "jellyfish", "sea foam", "driftwood"] },
  { label: "Small living things", items: ["feathers", "butterflies", "fireflies", "moths", "bees", "spider silk"] },
  { label: "More", items: NATURAL_ELEMENTS },
]);

export const MATERIAL_SUGGESTIONS = dedupe([
  {
    label: "Stone and mineral",
    items: ["weathered granite", "wet basalt", "polished river stone", "volcanic glass", "salt crust", "pale limestone", "slate", "black obsidian", "rough sandstone", "quartz crystal", "worn marble", "chalk cliffs", "mica-flecked rock", "lunar dust"],
  },
  {
    label: "Water and ice",
    items: ["glacial ice", "frost", "black ice", "still dark water", "sea glass", "frozen spray", "thin ice over black water", "meltwater", "rime ice", "wet sand"],
  },
  {
    label: "Plant",
    items: ["velvet moss", "translucent petals", "brittle autumn leaves", "soft lichen", "thin paper bark", "pale driftwood", "dry grass", "fern fronds", "seed filaments", "waxy leaves", "gnarled roots", "pine resin", "wet bark"],
  },
  { label: "Earth", items: ["fine wind-rippled sand", "dark loam", "cracked clay", "peat", "volcanic ash", "red earth", "silt"] },
  { label: "Air and light", items: ["dense fog", "low cloud", "smoke", "haze", "drifting pollen", "dust in a light beam", "steam"] },
  {
    label: "Made things",
    items: ["weathered painted wood", "tarnished brass", "rusted iron", "chipped white enamel", "worn leather", "linen", "wool", "old paper", "frosted glass", "porcelain", "faded red paint", "salt-bleached timber"],
  },
  { label: "More", items: MATERIALS },
]);

export const LIGHTING_SUGGESTIONS = dedupe([
  {
    label: "Moon and night",
    items: [
      "soft moonlight from behind the subject",
      "a full moon low on the horizon",
      "faint starlight and the afterglow of dusk",
      "moonlight glinting on water",
      "the cold glow of a crescent moon through cloud",
      "a single lit window in the darkness",
      "the faint green shimmer of an aurora",
      "a sky full of stars bright enough to cast shadows",
      "moonlight breaking through drifting fog",
      "deep blue night with a single source of warmth",
      "a lighthouse beam sweeping slowly through the dark",
      "the pale light of a moon behind thin cloud",
      "a meteor shower streaking silently overhead",
    ],
  },
  {
    label: "Sun and sky",
    items: [
      "last light grazing the horizon",
      "pale dawn light seeping across the land",
      "a single shaft of light breaking through cloud",
      "low winter sun casting long shadows",
      "a blood-orange sun sinking into haze",
      "diffuse light from a low, overcast sky",
      "a sun hidden behind thin cloud, a pale disc",
      "light falling in broad beams through high windows",
      "the blue hour, the sky glowing after sunset",
      "first rays of sun catching only the highest peaks",
      "a hazy golden afternoon, the light thick and slow",
      "a pale, washed-out midday sun",
      "a burning sunset reflected in still water",
      "a sliver of light at the horizon under a dark sky",
      "two suns low in the sky",
      "a sunrise seen through falling snow",
    ],
  },
  {
    label: "Glow",
    items: [
      "a soft glow from below the horizon",
      "a single warm light source in an otherwise dark scene",
      "light rising from beneath the water",
      "a soft glow emanating from the phenomenon itself",
      "bioluminescence along the shoreline",
      "a lantern's small circle of warm light",
      "embers glowing in the darkness",
      "a faint glow coming from inside a window",
      "luminous fungi lighting the forest floor",
      "fireflies scattered like slow sparks",
      "a column of light falling from a gap in the sky",
      "the subject itself giving off a soft light",
      "light glowing through translucent ice",
      "a soft halo around the moon",
    ],
  },
  {
    label: "Weather and atmosphere",
    items: [
      "backlight through thin fog",
      "cold reflected light from snow",
      "light diffused through falling rain",
      "a break in storm clouds, one patch of light",
      "lightning flickering far away",
      "god rays through mist between trees",
      "a storm light, bright land under a black sky",
      "a flat, shadowless light on a snowy day",
      "light dappled through leaves",
      "a rainbow arcing faintly through the mist",
      "the eerie green light before a storm",
      "silver light reflecting off wet stone",
    ],
  },
  {
    label: "Direction",
    items: [
      "strong rim light outlining the subject",
      "silhouetted against a bright horizon",
      "light from directly above",
      "light from a hidden source at ground level",
      "side light raking across the land",
      "light coming from behind the viewer",
      "a spotlight falling only on the subject",
      "contre-jour, the light directly behind everything",
      "light reflected up from water onto the subject",
    ],
  },
  { label: "More", items: LIGHTING },
]);

export const ATMOSPHERE_SUGGESTIONS = dedupe([
  {
    label: "Fog and mist",
    items: [
      "low drifting fog",
      "thin high mist",
      "fog pooling in the valleys",
      "a wall of fog advancing slowly",
      "mist rising from warm water",
      "sea haze softening the distance",
      "smoke-like low cloud",
      "fog so dense the horizon disappears",
      "wisps of mist curling around the subject",
      "a layer of fog lying flat just above the ground",
      "cloud pouring over a ridge like a slow waterfall",
      "a soft veil of haze over everything",
    ],
  },
  {
    label: "Rain and snow",
    items: [
      "soft falling snow",
      "fine rain hanging in the air",
      "snow blown sideways by the wind",
      "a light drizzle",
      "large, slow snowflakes",
      "freezing rain glazing everything",
      "a curtain of rain moving across the land",
      "rain falling upward",
      "snow falling in perfectly still air",
      "the hush after heavy snowfall",
      "hail scattered across the ground",
    ],
  },
  {
    label: "Air",
    items: [
      "still, perfectly clear air",
      "heavy humid air",
      "frozen, crystalline air",
      "thin cold air of high altitude",
      "warm air shimmering with heat",
      "a breathless calm before a storm",
      "a strong, steady wind",
      "air so clear the distance looks close",
      "a gentle breeze moving the grass",
      "the stillness of a windless night",
      "a heat haze bending the horizon",
      "a storm gathering on the horizon",
    ],
  },
  {
    label: "Particles",
    items: [
      "fine suspended dust catching the light",
      "pollen drifting in still light",
      "ash falling like snow",
      "seeds drifting on the air",
      "sparks rising slowly",
      "falling petals",
      "sea spray hanging in the air",
      "glittering ice crystals in the air",
      "dandelion seeds floating upward",
      "autumn leaves drifting down",
      "motes of light floating like dust",
      "feathers drifting slowly down",
      "bubbles rising through the air",
      "cherry blossom petals on the wind",
    ],
  },
  { label: "More", items: [...ATMOSPHERES, ...ATMOSPHERE_OPTIONS] },
]);

export const EMOTIONAL_TONE_SUGGESTIONS = dedupe([
  { label: "Quiet", items: ["stillness", "solitude", "contemplation", "introspection", "serenity", "calm", "hush", "patience", "peace", "quiet resolve"] },
  { label: "Wonder", items: ["quiet wonder", "awe", "transcendence", "mystery", "enchantment", "reverence", "discovery", "the sublime", "the feeling of being very small", "astonishment"] },
  { label: "Melancholy", items: ["peaceful melancholy", "nostalgia", "longing", "wistfulness", "loss", "remembrance", "bittersweet", "farewell"] },
  { label: "Warmth", items: ["belonging", "tenderness", "comfort", "hope", "gentleness", "companionship", "homecoming", "gratitude"] },
  { label: "Tension", items: ["anticipation", "unease", "suspense", "isolation", "vulnerability", "foreboding", "restlessness"] },
  { label: "Lightness", items: ["playfulness", "curiosity", "innocence", "joy", "freedom", "whimsy", "delight", "lightness"] },
  { label: "Time", items: ["timelessness", "a moment held still", "the end of something", "a beginning", "waiting", "the passing of seasons", "memory", "a dream half remembered"] },
  { label: "More", items: [...EMOTIONAL_TONES, ...TONES] },
]);

/* -------------------------------------------------------------------------- */
/* Character fields, fitted to the kind of subject                            */
/* -------------------------------------------------------------------------- */

type Group = ReturnType<typeof actionGroup>;

const LABELS: Record<Group, SuggestionGroup[]> = {
  human: [
    {
      label: "People",
      items: [
        "a figure in a long grey coat",
        "a child in a yellow raincoat",
        "an old woman with a walking stick",
        "a lone traveller with a small pack",
        "a figure carrying a lantern",
        "a person in a pale linen shirt",
        "a figure wrapped in a heavy blanket",
        "a girl in a red dress",
        "an old man in a flat cap",
        "a figure holding an umbrella",
        "a woman with long, loose hair",
        "a fisherman in oilskins",
        "a dancer mid-turn",
        "a cyclist pushing a bicycle",
        "a figure in a white hooded cloak",
        "two children holding hands",
      ],
    },
  ],
  quadruped: [
    {
      label: "Animals",
      items: ["a red fox", "an arctic fox", "a white hare", "a lone stag", "a pale horse", "a black horse", "a grey wolf", "a white wolf", "a black cat", "a ginger cat", "a fawn", "a doe with her fawn", "an elk", "a lynx"],
    },
  ],
  flyer: [{ label: "Birds", items: ["a white heron", "a single crow", "a small owl", "a snowy owl", "a flock of starlings", "a barn swallow", "a grey heron", "a swan", "a robin", "a kestrel", "a gull", "a migrating flock of geese"] }],
  swimmer: [{ label: "Whales and sea life", items: ["a humpback whale", "a pale whale", "a blue whale", "a slow manta ray", "a pod of orcas", "a sperm whale", "a narwhal"] }],
  small: [{ label: "Small creatures", items: ["a single moth", "a blue butterfly", "a firefly", "a dragonfly", "a bee", "a ladybird", "a monarch butterfly", "a luna moth", "a snail"] }],
  object: [
    {
      label: "Objects",
      items: [
        ...OBJECTS,
        "a paper boat",
        "a hot air balloon",
        "a bicycle",
        "a wooden door in its frame",
        "a clock without hands",
        "a birdcage",
        "a suitcase",
        "an armchair",
        "a lamp post",
        "a ladder",
        "a swing hanging from nothing",
        "a small wooden cabin",
        "a carousel horse",
        "a typewriter",
        "a bathtub",
      ],
    },
  ],
  none: [],
};

const MORE_ACTIONS: Record<Group, string[]> = {
  human: [
    "looking back over their shoulder",
    "holding an umbrella against no rain",
    "reading a book",
    "carrying a small bundle",
    "releasing a paper boat onto the water",
    "letting go of a balloon",
    "wading slowly into shallow water",
    "sitting on the edge, legs dangling",
    "pointing at something far away",
    "walking away from the viewer",
    "standing at the very edge",
    "dancing alone",
    "sleeping curled on the ground",
    "touching the surface of the phenomenon",
    "pushing a bicycle",
    "fishing from the shore",
  ],
  quadruped: ["grazing quietly", "running across open ground", "standing on a high rock", "nuzzling the ground", "lying in the grass", "wading through shallow water", "howling at the sky", "stepping carefully onto ice", "watching the phenomenon"],
  flyer: ["circling high overhead", "landing on water", "flying toward the light", "standing in shallow water", "perched on a single branch", "flying in formation", "diving toward the water"],
  swimmer: ["swimming through the air", "rising toward the surface", "resting just beneath the surface", "spouting a tall plume of mist", "swimming above the land"],
  small: ["drifting on the wind", "landing on an outstretched hand", "circling a light", "resting on a stone", "climbing a blade of grass"],
  object: ["sinking slowly", "lying on its side", "hanging in the air", "casting a long shadow", "reflected perfectly in water", "glowing faintly from within", "overgrown with moss"],
  none: [],
};

export const POSE_SUGGESTIONS: SuggestionGroup[] = [
  {
    label: "Standing",
    items: ["standing upright, arms at their sides", "head tilted slightly upward", "one hand raised to shade their eyes", "turned three-quarters away from the viewer", "leaning slightly forward", "arms wrapped around themselves", "hands in pockets", "arms outstretched", "one foot raised mid-step"],
  },
  { label: "Low", items: ["seated, back straight", "kneeling on one knee", "crouching low", "sitting with knees drawn up", "lying flat on their back", "curled on their side"] },
  { label: "Reaching", items: ["reaching up with one hand", "both hands raised to the sky", "reaching toward the water", "holding something close to the chest"] },
];

const CLOTHING: SuggestionGroup[] = [
  {
    label: "Coats and layers",
    items: ["a long grey wool coat", "a yellow raincoat", "a dark hooded cloak", "a heavy knitted jumper", "a faded red scarf", "an oilskin coat", "a white hooded cloak", "a quilted jacket"],
  },
  { label: "Simple", items: ["simple dark clothes", "a white shirt and dark trousers", "a pale linen dress", "a red dress", "a nightgown", "overalls", "a plain smock"] },
  { label: "Unusual", items: ["a spacesuit", "a diving suit", "a long white gown trailing on the ground", "a paper crown", "a wide-brimmed hat"] },
];

const FINISHES: SuggestionGroup[] = [
  {
    label: "Material and finish",
    items: ["weathered painted wood", "tarnished brass", "chipped white enamel", "faded red paint", "salt-bleached timber", "rusted iron", "worn leather", "frosted glass", "porcelain", "polished copper", "peeling blue paint", "moss-covered stone"],
  },
];

const HUMAN_LIKE: CharacterKind[] = ["adult", "child", "elderly", "traveler", "astronaut", "hiker", "silhouette"];

/** Suggestions for a character field, fitted to the kind of subject. Empty when the field does not apply. */
export function characterSuggestions(field: "subjectLabel" | "action" | "pose" | "clothing", kind: CharacterKind): SuggestionGroup[] {
  const group = actionGroup(kind);
  switch (field) {
    case "subjectLabel":
      return LABELS[group];
    case "action":
      return group === "none" ? [] : dedupe([{ label: "Actions", items: [...ACTIONS[group], ...MORE_ACTIONS[group]].filter(Boolean) }]);
    case "pose":
      return HUMAN_LIKE.includes(kind) ? POSE_SUGGESTIONS : [];
    case "clothing":
      return kind === "object" ? FINISHES : HUMAN_LIKE.includes(kind) ? CLOTHING : [];
  }
}
