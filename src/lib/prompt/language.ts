import type { Character, Composition } from "@/lib/domain/schemas";
import {
  CAMERA_ANGLE_OPTIONS,
  CHARACTER_NOUNS,
  COMPOSITION_PRESET_LANGUAGE,
  HUMAN_KINDS,
  type TimeOfDay,
} from "@/lib/domain/vocab";

/**
 * Translate numeric composition and scale controls into descriptive language.
 * Image models cannot guarantee pixel positions, so wording is deliberately approximate.
 */

export function subjectHeightLanguage(pct: number): string {
  if (pct <= 1.5) return "almost imperceptibly small, a mere speck within an overwhelmingly vast environment";
  if (pct <= 3) return "tiny, occupying only a sliver of the frame, utterly dwarfed by the vast environment around it";
  if (pct <= 6) return "very small in the frame, clearly readable yet overwhelmed by the scale of its surroundings";
  if (pct <= 12) return "small in the frame, with the environment clearly dominant";
  if (pct <= 25) return "modestly sized, sharing the frame with a substantial environment";
  if (pct <= 45) return "prominent, a clear focal presence within its setting";
  if (pct <= 70) return "large in the frame, the environment acting as context around it";
  return "filling most of the frame, seen up close";
}

export function horizontalWord(x: number) {
  if (x < 0.2) return "near the left edge";
  if (x < 0.4) return "in the left third";
  if (x <= 0.6) return "horizontally centred";
  if (x <= 0.8) return "in the right third";
  return "near the right edge";
}

export function verticalWord(y: number) {
  if (y < 0.2) return "near the top of the frame";
  if (y < 0.4) return "in the upper third";
  if (y <= 0.6) return "at mid-height";
  if (y <= 0.8) return "in the lower third";
  return "near the bottom of the frame";
}

export function positionLanguage(x: number, y: number): string {
  const h = horizontalWord(x);
  const v = verticalWord(y);
  if (h === "horizontally centred" && v === "at mid-height") return "placed approximately at the centre of the frame";
  if (h === "horizontally centred") return `placed approximately ${v}, horizontally centred`;
  return `placed approximately ${v}, ${h}`;
}

function band(value: number, words: [number, string][]): string {
  for (const [max, w] of words) if (value <= max) return w;
  return words[words.length - 1][1];
}

export function environmentalScaleLanguage(v: number) {
  return band(v, [
    [20, "an intimate, human-scaled environment"],
    [45, "a broad natural environment"],
    [70, "a vast, expansive environment"],
    [90, "a monumental environment of immense natural proportions"],
    [100, "an environment of almost incomprehensible, geological scale"],
  ]);
}

export function scaleExaggerationLanguage(v: number) {
  return band(v, [
    [15, "proportions remain natural and believable"],
    [40, "proportions are subtly heightened"],
    [70, "proportions are impossible yet rendered with complete conviction"],
    [100, "scale relationships are radically, dreamlike impossible while staying photographically real"],
  ]);
}

export function cameraDistanceLanguage(v: number) {
  return band(v, [
    [15, "photographed from close range"],
    [35, "photographed from a moderate distance"],
    [60, "photographed from a considerable distance"],
    [85, "photographed from far away, the subject distant"],
    [100, "photographed from an extreme distance"],
  ]);
}

export function depthLanguage(v: number) {
  return band(v, [
    [20, "a shallow, compressed sense of depth"],
    [50, "a natural sense of depth"],
    [80, "deep recession into atmospheric distance"],
    [100, "seemingly infinite depth, planes dissolving into haze"],
  ]);
}

export function foregroundScaleLanguage(v: number) {
  return band(v, [
    [20, "no significant foreground elements"],
    [45, "a quiet, low foreground"],
    [75, "a substantial foreground that anchors the scale"],
    [100, "an oversized foreground looming large against a tiny background"],
  ]);
}

export function cameraAngleLanguage(angle: Composition["cameraAngle"]) {
  const map: Record<Composition["cameraAngle"], string> = {
    "eye-level": "Eye-level viewpoint",
    low: "Low camera angle looking slightly upward",
    high: "High camera angle looking down",
    overhead: "Directly overhead viewpoint",
    "worms-eye": "Worm's-eye viewpoint from the ground",
    "birds-eye": "Bird's-eye viewpoint from high above",
  };
  return map[angle] ?? CAMERA_ANGLE_OPTIONS.find((o) => o.key === angle)?.label ?? "";
}

export function compositionLanguage(c: Composition, hasSubject: boolean): string {
  const parts: string[] = [];
  if (c.preset) parts.push(`Composition: ${COMPOSITION_PRESET_LANGUAGE[c.preset]}`);
  if (hasSubject) parts.push(`The primary subject is ${positionLanguage(c.x, c.y)}`);
  parts.push(`${cameraAngleLanguage(c.cameraAngle)}, ${cameraDistanceLanguage(c.cameraDistance)}`);
  parts.push(`with ${depthLanguage(c.depth)} and ${foregroundScaleLanguage(c.foregroundScale)}`);
  return parts.join(". ") + ".";
}

export function scaleLanguage(c: Composition, hasSubject: boolean): string {
  const parts = [`${capitalize(environmentalScaleLanguage(c.environmentalScale))}; ${scaleExaggerationLanguage(c.scaleExaggeration)}`];
  if (hasSubject) {
    parts.push(
      `The subject is ${subjectHeightLanguage(c.subjectHeight)} (roughly ${formatPct(c.subjectHeight)} of the frame height)`,
    );
  }
  return parts.join(". ") + ".";
}

function formatPct(v: number) {
  return v < 10 ? `${Math.round(v * 10) / 10}%` : `${Math.round(v)}%`;
}

export function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const DIRECTION_WORDS: Record<Character["direction"], string> = {
  unspecified: "",
  "facing-viewer": "facing the viewer",
  "facing-away": "facing away from the viewer",
  "profile-left": "seen in profile, facing left",
  "profile-right": "seen in profile, facing right",
  "three-quarter": "turned three-quarters toward the scene",
  "looking-up": "looking upward",
  "looking-down": "looking downward",
};

const MOVEMENT_WORDS: Record<Character["movement"], string> = {
  still: "standing perfectly still",
  walking: "walking slowly",
  running: "running",
  leaping: "caught mid-leap",
  flying: "in flight",
  floating: "floating weightlessly",
  swimming: "swimming",
  climbing: "climbing",
  drifting: "drifting gently",
  resting: "resting",
};

const RELATIONSHIP_WORDS: Record<Character["relationship"], string> = {
  dwarfed: "utterly dwarfed by the environment",
  observing: "quietly observing the phenomenon",
  traversing: "traversing the landscape",
  sheltered: "sheltered within the environment",
  interacting: "reaching toward or touching the phenomenon",
  emerging: "emerging from the environment",
  integrated: "almost indistinguishable from the place itself",
};

export function characterNoun(c: Character): string {
  if (c.kind === "none") return "";
  const [one, many] = CHARACTER_NOUNS[c.kind];
  const base = c.label.trim() || (c.count > 1 ? many : one);
  if (c.count > 1) return `${numberWord(c.count)} ${c.label.trim() ? c.label.trim() : many}`;
  return /^[aeiou]/i.test(base) ? `an ${base}` : `a ${base}`;
}

function numberWord(n: number) {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] ?? String(n);
}

export function silhouetteLanguage(v: number) {
  return band(v, [
    [20, "rendered with full visible detail"],
    [50, "partly in shadow, details softly visible"],
    [80, "read primarily as a clean silhouette"],
    [100, "a pure, crisp silhouette with no interior detail"],
  ]);
}

export function characterLanguage(c: Character, role: "primary" | "secondary" = "primary"): string {
  if (c.kind === "none") return "";
  const parts: string[] = [];
  const noun = characterNoun(c);
  const lead = role === "primary" ? "The subject is" : "A secondary subject:";
  const movement = MOVEMENT_WORDS[c.movement];
  const direction = DIRECTION_WORDS[c.direction];
  parts.push(`${lead} ${noun}${movement ? `, ${movement}` : ""}${direction ? `, ${direction}` : ""}`);
  if (c.pose.trim()) parts.push(`Pose: ${c.pose.trim()}`);
  if (c.clothing.trim() && (HUMAN_KINDS.includes(c.kind) || c.kind === "object")) {
    parts.push(`${c.kind === "object" ? "Material and finish" : "Clothing"}: ${c.clothing.trim()}`);
  }
  parts.push(`${c.count > 1 ? "They are" : "It is"} ${silhouetteLanguage(c.silhouetteStrength)}, ${RELATIONSHIP_WORDS[c.relationship]}`);
  return parts.join(". ") + ".";
}

export function timeOfDayLanguage(t: TimeOfDay): string {
  const map: Record<TimeOfDay, string> = {
    unspecified: "",
    "pre-dawn": "in the deep blue stillness before dawn",
    dawn: "at first light of dawn",
    morning: "in soft morning light",
    midday: "under high midday light",
    afternoon: "in late afternoon light",
    "golden-hour": "in low golden-hour light",
    dusk: "at dusk, the last light fading",
    "blue-hour": "during the blue hour",
    night: "at night",
    "deep-night": "in the deep of night",
    timeless: "at an unplaceable, timeless hour",
  };
  return map[t];
}
