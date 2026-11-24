import {
  ANCHORS,
  CHARACTER_KINDS,
  CHARACTER_NOUNS,
  COMPOSITION_PRESETS,
  TIMES_OF_DAY,
  type Anchor,
  type CharacterKind,
  type CompositionPreset,
} from "@/lib/domain/vocab";
import {
  characterSchema,
  compositionSchema,
  conceptSchema,
  paletteSchema,
  type Concept,
  type ConceptVariable,
  type SceneContent,
} from "@/lib/domain/schemas";
import { ANCHOR_POINTS } from "@/lib/domain/vocab";
import { detectMaterials, makeSwatch, materialPalette } from "@/lib/palette/engine";
import {
  ACTIONS,
  ATMOSPHERE_OPTIONS,
  ENVIRONMENTS,
  LIGHTING,
  OBJECTS,
  PHENOMENA,
  SCALE_RELATIONSHIPS,
  TITLE_ADJECTIVES,
  TITLE_NOUNS,
  TONES,
  actionGroup,
} from "./library";

/* -------------------------------------------------------------------------- */
/* Seeded randomness                                                          */
/* -------------------------------------------------------------------------- */

export type Rand = () => number;

/** mulberry32: small, fast, deterministic PRNG. */
export function createRng(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: Rand, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

/* -------------------------------------------------------------------------- */
/* History: discourages repeating combinations                                */
/* -------------------------------------------------------------------------- */

export type History = {
  character: Record<string, number>;
  environment: Record<string, number>;
  phenomenon: Record<string, number>;
  composition: Record<string, number>;
  anchor: Record<string, number>;
  emotionalTone: Record<string, number>;
  lighting: Record<string, number>;
  combos: Record<string, number>;
};

export const emptyHistory = (): History => ({
  character: {},
  environment: {},
  phenomenon: {},
  composition: {},
  anchor: {},
  emotionalTone: {},
  lighting: {},
  combos: {},
});

const bump = (r: Record<string, number>, k: string | null | undefined) => {
  if (!k) return;
  r[k] = (r[k] ?? 0) + 1;
};

export function comboKey(c: { character: string; phenomenon: string; composition: string }) {
  return `${c.character}|${c.phenomenon.slice(0, 40)}|${c.composition}`;
}

export function historyFromScenes(scenes: Pick<SceneContent, "subject" | "environment" | "phenomenon" | "composition" | "emotionalTone" | "lighting">[]): History {
  const h = emptyHistory();
  for (const s of scenes) {
    bump(h.character, s.subject.kind);
    bump(h.environment, s.environment);
    bump(h.phenomenon, s.phenomenon);
    bump(h.composition, s.composition.preset ?? undefined);
    bump(h.anchor, s.composition.anchor);
    bump(h.emotionalTone, s.emotionalTone);
    bump(h.lighting, s.lighting);
    bump(h.combos, comboKey({ character: s.subject.kind, phenomenon: s.phenomenon, composition: s.composition.preset ?? "" }));
  }
  return h;
}

export function recordConcept(h: History, c: Concept) {
  bump(h.character, c.character);
  bump(h.environment, c.environment);
  bump(h.phenomenon, c.phenomenon);
  bump(h.composition, c.composition);
  bump(h.anchor, c.anchor);
  bump(h.emotionalTone, c.emotionalTone);
  bump(h.lighting, c.lighting);
  bump(h.combos, comboKey(c));
}

/** Pick with weight 1 / (1 + uses * strength): the more something was used, the less likely it is. */
export function weightedPick<T>(rand: Rand, items: readonly T[], key: (t: T) => string, usage: Record<string, number>, strength = 1.5, exclude?: Set<string>): T {
  const pool = exclude ? items.filter((i) => !exclude.has(key(i))) : items;
  const list = pool.length ? pool : items;
  const weights = list.map((i) => 1 / (1 + (usage[key(i)] ?? 0) * strength));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

/* -------------------------------------------------------------------------- */
/* Concept generation                                                         */
/* -------------------------------------------------------------------------- */

const ANCHOR_CHOICES = ANCHORS.filter((a) => a !== "custom") as Exclude<Anchor, "custom">[];
const CHARACTER_CHOICES = CHARACTER_KINDS.filter((k) => k !== "none" || true);

export type GenerateOptions = {
  rand: Rand;
  history?: History;
  /** Variables whose values must be preserved, taken from `base`. */
  locked?: Partial<Record<ConceptVariable, unknown>>;
  base?: Concept | null;
  /** Higher values push harder toward unused options. */
  novelty?: number;
  /** When set, unlocked variables must differ from base. */
  diverge?: boolean;
  /** Probability of keeping each unlocked base variable (for "more like this"). */
  keepProbability?: number;
};

function titleFor(rand: Rand) {
  return `The ${pick(rand, TITLE_ADJECTIVES)} ${pick(rand, TITLE_NOUNS)}`;
}

function characterPhrase(kind: CharacterKind, label: string) {
  if (kind === "none") return "";
  const noun = label || CHARACTER_NOUNS[kind][0];
  return /^(a|an|the)\s/i.test(noun) ? noun : `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

export function loglineFor(c: Pick<Concept, "character" | "characterLabel" | "action" | "environment" | "phenomenon">) {
  const who = characterPhrase(c.character, c.characterLabel);
  const lead = who ? `${who[0].toUpperCase()}${who.slice(1)}${c.action ? `, ${c.action},` : ""} in ${c.environment}` : `${c.environment[0].toUpperCase()}${c.environment.slice(1)}, empty of figures`;
  return `${lead}, where ${c.phenomenon}.`.replace(/\s+/g, " ");
}

export function generateConcept(opts: GenerateOptions): Concept {
  const { rand, base } = opts;
  const history = opts.history ?? emptyHistory();
  const strength = 1.5 * (opts.novelty ?? 1);
  const locked = opts.locked ?? {};
  const isLocked = (v: ConceptVariable) => base != null && v in locked;
  const keep = (v: ConceptVariable) =>
    isLocked(v) || (base != null && opts.keepProbability != null && rand() < opts.keepProbability);
  const ex = (v: string | undefined) => (opts.diverge && v ? new Set([v]) : undefined);

  // Character
  let character: CharacterKind;
  let characterLabel = "";
  if (keep("character") && base) {
    character = base.character;
    characterLabel = base.characterLabel;
  } else {
    character = weightedPick(rand, CHARACTER_CHOICES, (k) => k, history.character, strength, ex(base?.character));
    if (character === "object") characterLabel = pick(rand, OBJECTS).replace(/^(a|an)\s/, "");
  }

  const action = keep("action") && base ? base.action : pick(rand, ACTIONS[actionGroup(character)]);

  const phenomenonEntry =
    keep("phenomenon") && base
      ? (PHENOMENA.find((p) => p.text === base.phenomenon) ?? { text: base.phenomenon, kind: "scale" as const, element: base.naturalElement, material: base.material })
      : weightedPick(rand, PHENOMENA, (p) => p.text, history.phenomenon, strength, ex(base?.phenomenon));

  const environment =
    keep("environment") && base ? base.environment : weightedPick(rand, ENVIRONMENTS, (e) => e, history.environment, strength, ex(base?.environment));

  const naturalElement = keep("naturalElement") && base ? base.naturalElement : phenomenonEntry.element;
  const material = keep("material") && base ? base.material : phenomenonEntry.material;

  const scaleEntry =
    keep("scale") && base
      ? { text: base.scale, height: base.subjectHeight }
      : character === "none"
        ? { text: "the environment alone carries the scale", height: 4 }
        : pick(rand, SCALE_RELATIONSHIPS);

  const composition: CompositionPreset =
    keep("composition") && base
      ? base.composition
      : weightedPick(rand, COMPOSITION_PRESETS, (c) => c, history.composition, strength, ex(base?.composition));
  const anchor: Anchor =
    keep("composition") && base ? base.anchor : weightedPick(rand, ANCHOR_CHOICES, (a) => a, history.anchor, strength * 1.5);

  const emotionalTone =
    keep("emotionalTone") && base ? base.emotionalTone : weightedPick(rand, TONES, (t) => t, history.emotionalTone, strength, ex(base?.emotionalTone));
  const lighting = keep("lighting") && base ? base.lighting : weightedPick(rand, LIGHTING, (l) => l, history.lighting, strength, ex(base?.lighting));
  const atmosphere = keep("atmosphere") && base ? base.atmosphere : pick(rand, ATMOSPHERE_OPTIONS);

  let palette: string[];
  let paletteName: string;
  if (keep("palette") && base) {
    palette = base.palette;
    paletteName = base.paletteName;
  } else {
    const text = `${environment} ${phenomenonEntry.text} ${material} ${naturalElement}`;
    palette = materialPalette(text, 5);
    const mats = detectMaterials(text);
    paletteName = mats.length ? mats.slice(0, 2).map((m) => m.label).join(" and ") : "Mineral neutrals";
  }

  const timeOfDay = pick(rand, TIMES_OF_DAY.filter((t) => t !== "unspecified" && t !== "midday"));

  const draft = {
    title: titleFor(rand),
    logline: "",
    character,
    characterLabel,
    action,
    environment,
    naturalElement,
    material,
    scale: scaleEntry.text,
    subjectHeight: scaleEntry.height,
    phenomenon: phenomenonEntry.text,
    composition,
    anchor,
    emotionalTone,
    lighting,
    timeOfDay,
    palette,
    paletteName,
    atmosphere,
  };
  draft.logline = loglineFor(draft);
  return conceptSchema.parse(draft);
}

export type ConceptMode = "randomize-all" | "randomize-unlocked" | "surprise" | "batch" | "similar" | "new-direction";

export function generateConcepts(
  mode: ConceptMode,
  opts: { seed: number; count?: number; history?: History; locked?: Partial<Record<ConceptVariable, unknown>>; base?: Concept | null },
): Concept[] {
  const rand = createRng(opts.seed);
  const history = structuredClone(opts.history ?? emptyHistory());
  const count = mode === "batch" ? Math.max(5, opts.count ?? 5) : (opts.count ?? 1);
  const out: Concept[] = [];
  for (let i = 0; i < count; i++) {
    let c: Concept;
    switch (mode) {
      case "randomize-all":
        c = generateConcept({ rand, history });
        break;
      case "randomize-unlocked":
        c = generateConcept({ rand, history, base: opts.base, locked: opts.locked });
        break;
      case "surprise":
        c = generateConcept({ rand, history, novelty: 3 });
        break;
      case "similar":
        c = generateConcept({ rand, history, base: opts.base, locked: opts.locked, keepProbability: 0.55 });
        break;
      case "new-direction":
        c = generateConcept({ rand, history, base: opts.base, locked: opts.locked, diverge: true, novelty: 2.5 });
        break;
      case "batch":
      default:
        c = generateConcept({ rand, history, base: opts.base, locked: opts.locked, novelty: 1.5 });
    }
    // Avoid exact repeats of a combination already used in this batch or history.
    if ((history.combos[comboKey(c)] ?? 0) > 0 && i < count + 3) {
      const retry = generateConcept({ rand, history, base: opts.base, locked: opts.locked, novelty: 3 });
      if ((history.combos[comboKey(retry)] ?? 0) === 0) c = retry;
    }
    recordConcept(history, c);
    out.push(c);
  }
  return out;
}

/** Translate a structured concept into Studio scene settings. */
export function conceptToScene(c: Concept): Partial<SceneContent> {
  const anchorPoint = c.anchor === "custom" ? [0.5, 0.7] : ANCHOR_POINTS[c.anchor];
  const subject = characterSchema.parse({
    kind: c.character,
    label: c.characterLabel,
    action: c.action,
    movement: /leap/.test(c.action)
      ? "leaping"
      : /walk/.test(c.action)
        ? "walking"
        : /fly|glid/.test(c.action)
          ? "flying"
          : /drift/.test(c.action)
            ? "drifting"
            : /sit|lying|curled|resting/.test(c.action)
              ? "resting"
              : "still",
    count: 1,
    relationship: c.subjectHeight < 6 ? "dwarfed" : "observing",
  });
  return {
    title: c.title.replace(/^The /, "The "),
    description: c.logline,
    environment: c.environment,
    subject,
    naturalElement: c.naturalElement,
    phenomenon: c.phenomenon,
    emotionalTone: c.emotionalTone,
    atmosphere: c.atmosphere,
    timeOfDay: c.timeOfDay,
    materials: c.material,
    lighting: c.lighting,
    composition: compositionSchema.parse({
      preset: c.composition,
      anchor: c.anchor,
      x: anchorPoint[0],
      y: anchorPoint[1],
      subjectHeight: c.subjectHeight,
      cameraAngle:
        c.composition === "worms-eye" ? "worms-eye" : c.composition === "birds-eye" ? "birds-eye" : c.composition === "overhead" ? "overhead" : "eye-level",
    }),
    palette: paletteSchema.parse({ mode: "material", swatches: c.palette.map((h) => makeSwatch(h)) }),
  };
}

/** Current scene expressed as a concept, so Explore can build "more like this" from Studio. */
export function sceneToConcept(s: SceneContent): Concept | null {
  const parsed = conceptSchema.safeParse({
    title: s.title || "Untitled",
    logline: s.description || "",
    character: s.subject.kind,
    characterLabel: s.subject.label,
    action: s.subject.action,
    environment: s.environment || "an unnamed landscape",
    naturalElement: s.naturalElement || "stone",
    material: s.materials || "stone",
    scale: `subject at ${s.composition.subjectHeight}% of frame`,
    subjectHeight: s.composition.subjectHeight,
    phenomenon: s.phenomenon || "a quiet impossibility",
    composition: s.composition.preset ?? "extreme-negative-space",
    anchor: s.composition.anchor,
    emotionalTone: s.emotionalTone || "stillness",
    lighting: s.lighting || "soft moonlight",
    timeOfDay: s.timeOfDay,
    palette: s.palette.swatches.length >= 3 ? s.palette.swatches.slice(0, 6).map((w) => w.hex) : materialPalette(s.environment, 5),
    paletteName: "Current palette",
    atmosphere: s.atmosphere || "still air",
  });
  return parsed.success ? parsed.data : null;
}
