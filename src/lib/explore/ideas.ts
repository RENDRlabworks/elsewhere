import type { Character, SceneContent } from "@/lib/domain/schemas";
import { ATMOSPHERES, EMOTIONAL_TONES, IDEA_FIELDS, MATERIALS, NATURAL_ELEMENTS, type CharacterKind, type IdeaField } from "@/lib/domain/vocab";
import { loglineFor } from "./engine";
import {
  ACTIONS,
  actionGroup,
  ATMOSPHERE_OPTIONS,
  ENVIRONMENTS,
  LIGHTING,
  OBJECTS,
  PHENOMENA,
  TITLE_ADJECTIVES,
  TITLE_NOUNS,
  TONES,
} from "./library";

/**
 * Per-field ideas for the Studio's free-text fields. The built-in pools work
 * instantly and offline; the AI route adds ideas written for the rest of the scene.
 */

export { IDEA_FIELDS, type IdeaField };

/** Fields that describe a character. They take the character being edited as context. */
export const CHARACTER_IDEA_FIELDS: readonly IdeaField[] = ["subjectLabel", "action", "pose", "clothing"];

export const IDEA_FIELD_LABELS: Record<IdeaField, string> = {
  title: "a short, evocative title (two to five words)",
  description: "a one-sentence description of the scene",
  freeDirection: "one short piece of art direction the structured controls do not capture",
  subjectLabel: "a short description of the subject (a noun phrase)",
  action: "what the subject is doing, in a few words",
  pose: "the subject's pose, in a few words",
  clothing: "what the subject wears, or for an object its material and finish",
  environment: "the setting, as a short noun phrase",
  phenomenon: "the impossible phenomenon, one clause",
  naturalElement: "one natural element (one or two words)",
  materials: "two or three materials, comma separated",
  lighting: "the lighting, one short phrase",
  atmosphere: "the atmosphere, one short phrase",
  emotionalTone: "the emotional tone, one to three words",
};

const FREE_DIRECTIONS = [
  "Leave the upper two thirds of the frame almost empty.",
  "Let the light source sit just behind the subject so it reads as a silhouette.",
  "Keep the horizon very low and let the sky carry the image.",
  "Let the phenomenon be partly lost in haze, discovered rather than announced.",
  "Nothing in the scene should look staged; it should feel like an ordinary evening in another world.",
  "Keep every edge soft except the subject's outline.",
  "The only movement in the scene is the subject; everything else is completely still.",
  "Let the reflection carry as much weight as the thing reflected.",
  "Frame it as if seen by someone who has just stopped walking.",
  "Let one faint secondary light echo the main one far in the distance.",
  "Keep the foreground almost black so the eye travels straight to the light.",
  "The scale should only become clear on a second look.",
];

const SUBJECT_LABELS: Record<ReturnType<typeof actionGroup>, string[]> = {
  human: [
    "a figure in a long grey coat",
    "a child in a yellow raincoat",
    "an old woman with a walking stick",
    "a lone traveller with a small pack",
    "a figure carrying a lantern",
    "a person in a pale linen shirt",
    "a figure wrapped in a heavy blanket",
  ],
  quadruped: ["a red fox", "a white hare", "a lone stag", "a pale horse", "a grey wolf", "a black cat"],
  flyer: ["a white heron", "a single crow", "a small owl", "a flock of starlings", "a barn swallow"],
  swimmer: ["a humpback whale", "a pale whale", "a slow manta ray"],
  small: ["a single moth", "a blue butterfly", "a firefly", "a dragonfly"],
  object: OBJECTS,
  none: [],
};

const POSES = [
  "standing upright, arms at their sides",
  "head tilted slightly upward",
  "one hand raised to shade their eyes",
  "seated, back straight",
  "turned three-quarters away from the viewer",
  "leaning slightly forward",
  "kneeling on one knee",
  "arms wrapped around themselves",
];

const CLOTHING = [
  "a long grey wool coat",
  "a yellow raincoat",
  "a pale linen dress",
  "a dark hooded cloak",
  "a heavy knitted jumper",
  "a faded red scarf",
  "simple dark clothes",
  "a white shirt and dark trousers",
];

const OBJECT_FINISHES = [
  "weathered painted wood",
  "tarnished brass",
  "chipped white enamel",
  "faded red paint",
  "salt-bleached timber",
  "rusted iron",
  "worn leather",
];

const HUMAN_LIKE: CharacterKind[] = ["adult", "child", "elderly", "traveler", "astronaut", "hiker", "silhouette"];

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function combos(rand: () => number, a: readonly string[], b: readonly string[], join: (x: string, y: string) => string, n: number) {
  const out: string[] = [];
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const x = a[Math.floor(rand() * a.length)];
    const y = b[Math.floor(rand() * b.length)];
    if (x !== y) out.push(join(x, y));
  }
  return out;
}

function pool(field: IdeaField, scene: SceneContent, character: Character, rand: () => number): string[] {
  const group = actionGroup(character.kind);
  switch (field) {
    case "title":
      return combos(rand, TITLE_ADJECTIVES, TITLE_NOUNS, (a, n) => `The ${a} ${n}`, 12);
    case "description": {
      const env = shuffle(scene.environment ? [scene.environment] : ENVIRONMENTS, rand);
      const phen = shuffle(scene.phenomenon ? [scene.phenomenon] : PHENOMENA.map((p) => p.text), rand);
      const actions = shuffle(character.action ? [character.action] : ACTIONS[group], rand);
      return Array.from({ length: 6 }, (_, i) =>
        loglineFor({
          character: scene.subject.kind,
          characterLabel: scene.subject.label,
          action: actions[i % Math.max(1, actions.length)] ?? "",
          environment: env[i % env.length],
          phenomenon: phen[i % phen.length],
        }),
      );
    }
    case "freeDirection":
      return FREE_DIRECTIONS;
    case "subjectLabel":
      return SUBJECT_LABELS[group];
    case "action":
      return ACTIONS[group];
    case "pose":
      return HUMAN_LIKE.includes(character.kind) ? POSES : [];
    case "clothing":
      return character.kind === "object" ? OBJECT_FINISHES : HUMAN_LIKE.includes(character.kind) ? CLOTHING : [];
    case "environment":
      return ENVIRONMENTS;
    case "phenomenon":
      return PHENOMENA.map((p) => p.text);
    case "naturalElement":
      return [...NATURAL_ELEMENTS];
    case "materials":
      return combos(rand, MATERIALS, MATERIALS, (a, b) => `${a}, ${b}`, 12);
    case "lighting":
      return LIGHTING;
    case "atmosphere":
      return [...new Set([...ATMOSPHERES, ...ATMOSPHERE_OPTIONS])];
    case "emotionalTone":
      return [...EMOTIONAL_TONES, ...combos(rand, [...EMOTIONAL_TONES, ...TONES], TONES, (a, b) => `${a} and ${b}`, 6)];
  }
}

/** Current text of a field, for avoiding repeats. */
export function fieldValue(field: IdeaField, scene: SceneContent, character: Character): string {
  switch (field) {
    case "subjectLabel":
      return character.label;
    case "action":
    case "pose":
    case "clothing":
      return character[field];
    default:
      return scene[field];
  }
}

/** Up to `count` distinct built-in ideas for a field, never the current value. */
export function localIdeas(field: IdeaField, scene: SceneContent, opts: { character?: Character; count?: number; rand?: () => number } = {}): string[] {
  const rand = opts.rand ?? Math.random;
  const character = opts.character ?? scene.subject;
  const current = fieldValue(field, scene, character).trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const idea of shuffle(pool(field, scene, character, rand), rand)) {
    const key = idea.trim().toLowerCase();
    if (!key || key === current || seen.has(key)) continue;
    seen.add(key);
    out.push(idea);
    if (out.length >= (opts.count ?? 6)) break;
  }
  return out;
}

/** A field has ideas when its pool is non-empty for the character being edited. */
export function hasIdeas(field: IdeaField, character: Character): boolean {
  if (field === "subjectLabel") return character.kind !== "none";
  if (field === "pose") return HUMAN_LIKE.includes(character.kind);
  if (field === "clothing") return character.kind === "object" || HUMAN_LIKE.includes(character.kind);
  if (field === "action") return character.kind !== "none";
  return true;
}
