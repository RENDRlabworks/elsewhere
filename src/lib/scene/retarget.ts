import type { Character, SceneContent } from "@/lib/domain/schemas";
import { CHARACTER_NOUNS, HUMAN_KINDS, type CharacterKind } from "@/lib/domain/vocab";
import { localIdeas } from "@/lib/explore/ideas";
import { actionGroup } from "@/lib/explore/library";

/**
 * Keep a scene consistent when its subject changes. Every text field that names the
 * old subject is rewritten to name the new one, and character details that only made
 * sense for the old kind (an action, pose, clothing or description) are replaced or
 * cleared. Pure and deterministic apart from the optional `rand` for new actions.
 */

type Slot = "subject" | "secondarySubject";

/** Scene text fields that can mention the subject. */
export const SUBJECT_TEXT_FIELDS = [
  "title",
  "description",
  "freeDirection",
  "phenomenon",
  "environment",
  "lighting",
  "atmosphere",
  "materials",
  "emotionalTone",
] as const;
type TextField = (typeof SUBJECT_TEXT_FIELDS)[number];

export const FIELD_NAMES: Record<TextField | "action" | "pose" | "clothing" | "label", string> = {
  title: "title",
  description: "description",
  freeDirection: "free direction",
  phenomenon: "phenomenon",
  environment: "environment",
  lighting: "lighting",
  atmosphere: "atmosphere",
  materials: "materials",
  emotionalTone: "emotional tone",
  action: "action",
  pose: "pose",
  clothing: "clothing",
  label: "subject description",
};

/** Words people use for each kind, most specific first. Plurals are derived. */
const SYNONYMS: Record<CharacterKind, string[]> = {
  none: [],
  adult: ["adult figure", "adult", "figure", "person", "man", "woman"],
  child: ["child", "girl", "boy", "kid"],
  elderly: ["elderly person", "elderly figure", "old man", "old woman", "elder"],
  traveler: ["traveler", "traveller", "wanderer"],
  astronaut: ["astronaut"],
  hiker: ["hiker", "walker"],
  cat: ["cat", "kitten"],
  fox: ["fox"],
  deer: ["deer", "stag", "doe", "fawn"],
  rabbit: ["rabbit", "hare"],
  bird: ["bird"],
  wolf: ["wolf"],
  horse: ["horse", "mare", "stallion", "pony"],
  whale: ["whale"],
  butterfly: ["butterfly", "moth"],
  insect: ["insect", "beetle"],
  silhouette: ["abstract silhouette", "silhouette", "figure"],
  object: [],
};

const IRREGULAR_PLURALS: Record<string, string> = {
  man: "men",
  woman: "women",
  "old man": "old men",
  "old woman": "old women",
  child: "children",
  wolf: "wolves",
  deer: "deer",
  person: "people",
  "elderly person": "elderly people",
  butterfly: "butterflies",
  moth: "moths",
  fox: "foxes",
  pony: "ponies",
};
const plural = (w: string) => IRREGULAR_PLURALS[w] ?? `${w}s`;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const matchCase = (src: string, out: string) =>
  src === src.toUpperCase() && src.length > 1 ? out.toUpperCase() : src[0] === src[0].toUpperCase() ? out[0].toUpperCase() + out.slice(1) : out;

/** The noun a character is called by in text: its label when set, else its kind's noun. */
function nounFor(c: Character): { singular: string; plural: string } {
  const label = c.label.trim().replace(/^(a|an|the)\s+/i, "");
  if (label) {
    const words = label.split(/\s+/);
    const last = words.pop()!;
    const pl = IRREGULAR_PLURALS[last.toLowerCase()] ?? (/(s|x|ch|sh)$/i.test(last) ? `${last}es` : /[^aeiou]y$/i.test(last) ? `${last.slice(0, -1)}ies` : `${last}s`);
    return { singular: label, plural: [...words, pl].join(" ") };
  }
  const [singular, pl] = CHARACTER_NOUNS[c.kind];
  return { singular, plural: pl };
}

/** Phrases that refer to the old subject, longest first, each with what to replace it by. */
function replacements(prev: Character, next: Character): [RegExp, (m: string, art?: string) => string][] {
  const to = nounFor(next);
  const out: { from: string; to: string }[] = [];
  const label = prev.label.trim().replace(/^(a|an|the)\s+/i, "");
  if (label.length > 2) out.push({ from: label, to: to.singular });
  for (const w of SYNONYMS[prev.kind]) {
    out.push({ from: plural(w), to: to.plural });
    out.push({ from: w, to: to.singular });
  }
  if (prev.kind === "object" && !label) out.push({ from: "object", to: to.singular });
  const seen = new Set<string>();
  return out
    .filter((r) => r.from && !seen.has(r.from.toLowerCase()) && seen.add(r.from.toLowerCase()))
    .sort((a, b) => b.from.length - a.from.length)
    .map(({ from, to: target }) => [
      new RegExp(`\\b(?:(a|an)\\s+)?${escape(from)}\\b`, "gi"),
      (m: string, art?: string) => {
        const word = m.slice(art ? art.length + 1 : 0);
        const replaced = matchCase(word, target);
        return art ? `${matchCase(art, article(target))} ${replaced}` : replaced;
      },
    ]);
}

/** Replace every mention of the old subject in a piece of text. */
export function renameSubjectIn(text: string, prev: Character, next: Character): string {
  if (!text || prev.kind === "none" || next.kind === "none") return text;
  let out = text;
  // Replace in one pass per phrase, protecting text already rewritten by a longer phrase.
  const marks: string[] = [];
  for (const [re, fn] of replacements(prev, next)) {
    out = out.replace(re, (m: string, art?: string) => {
      marks.push(fn(m, art));
      return `\u0000${marks.length - 1}\u0000`;
    });
  }
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => marks[Number(i)]);
}

/** Whether a piece of text names the given subject. */
export function mentionsSubject(text: string, c: Character): boolean {
  if (!text || c.kind === "none") return false;
  return replacements(c, c).some(([re]) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

const isHumanLike = (k: CharacterKind) => HUMAN_KINDS.includes(k);

export type RetargetResult = { patch: Partial<SceneContent>; changed: string[]; unresolved: string[] };

/**
 * Apply a change to one of the scene's characters and bring the rest of the scene in
 * line with it. `changed` lists the fields that were rewritten; `unresolved` lists
 * fields that still mention the old subject (for example when there is no subject now).
 */
export function retargetSubject(
  scene: SceneContent,
  slot: Slot,
  next: Character,
  opts: { rand?: () => number; skip?: readonly string[] } = {},
): RetargetResult {
  const rand = opts.rand ?? Math.random;
  const skip = new Set(opts.skip ?? []);
  const prev = slot === "subject" ? scene.subject : scene.secondarySubject;
  if (!prev) return { patch: { [slot]: next }, changed: [], unresolved: [] };
  const kindChanged = prev.kind !== next.kind;
  const labelChanged = prev.label.trim() !== next.label.trim();
  if (!kindChanged && !labelChanged) return { patch: { [slot]: next }, changed: [], unresolved: [] };

  const changed: string[] = [];
  const character: Character = { ...next };

  if (kindChanged) {
    const prevGroup = actionGroup(prev.kind);
    const nextGroup = actionGroup(next.kind);
    // A description written for the old kind ("a red fox") rarely fits the new one.
    const prevNoun = CHARACTER_NOUNS[prev.kind][0];
    const labelNamesOld = !!prev.label && SYNONYMS[prev.kind].some((w) => new RegExp(`\\b${escape(w)}`, "i").test(prev.label));
    if (character.label && (prev.kind === "object" || next.kind === "object" || next.kind === "none" || labelNamesOld || (prevNoun && prev.label.toLowerCase().includes(prevNoun)))) {
      character.label = "";
      changed.push(FIELD_NAMES.label);
    }
    if (prevGroup !== nextGroup && character.action) {
      const [action] = next.kind === "none" ? [""] : localIdeas("action", { ...scene, [slot]: character } as SceneContent, { character, count: 1, rand });
      character.action = action ?? "";
      changed.push(FIELD_NAMES.action);
    }
    if (character.pose && isHumanLike(prev.kind) !== isHumanLike(next.kind)) {
      character.pose = "";
      changed.push(FIELD_NAMES.pose);
    }
    const wore = isHumanLike(prev.kind) ? "human" : prev.kind === "object" ? "object" : "none";
    const wears = isHumanLike(next.kind) ? "human" : next.kind === "object" ? "object" : "none";
    if (character.clothing && wore !== wears) {
      character.clothing = "";
      changed.push(FIELD_NAMES.clothing);
    }
  }

  const patch: Partial<SceneContent> = { [slot]: character };
  const unresolved: string[] = [];
  const target = { ...character, label: kindChanged ? character.label : next.label };
  for (const f of SUBJECT_TEXT_FIELDS) {
    const before = scene[f];
    if (!before) continue;
    if (skip.has(f)) {
      if (mentionsSubject(before, prev)) unresolved.push(FIELD_NAMES[f]);
      continue;
    }
    if (next.kind === "none") {
      if (mentionsSubject(before, prev)) unresolved.push(FIELD_NAMES[f]);
      continue;
    }
    const after = renameSubjectIn(before, prev, target);
    if (after !== before) {
      patch[f] = after;
      changed.push(FIELD_NAMES[f]);
    }
  }
  return { patch, changed, unresolved };
}

/** "title, description and action" */
export function listFields(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
