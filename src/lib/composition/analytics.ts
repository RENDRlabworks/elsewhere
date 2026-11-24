import {
  ANCHORS,
  CAMERA_ANGLES,
  CHARACTER_OPTIONS,
  COMPOSITION_PRESET_OPTIONS,
  COMPOSITION_PRESETS,
  type Anchor,
  type CameraAngle,
  type CompositionPreset,
} from "@/lib/domain/vocab";
import type { Generation, SceneContent } from "@/lib/domain/schemas";
import { hueFamily } from "@/lib/palette/color";
import { effectiveSwatches } from "@/lib/palette/engine";

export type Distribution = { key: string; label: string; count: number; share: number }[];

export type CollectionInsights = {
  total: number;
  analysed: number;
  heatmap: number[][]; // 5x5 grid of subject placement counts, rows top to bottom
  anchors: Distribution;
  presets: Distribution;
  cameraAngles: Distribution;
  characters: Distribution;
  environments: Distribution;
  paletteFamilies: Distribution;
  acceptance: { accepted: number; rejected: number; unreviewed: number; rate: number | null };
  diversity: { character: number; environment: number; composition: number; placement: number; palette: number };
  repeatedPatterns: { description: string; count: number }[];
  suggestions: { kind: "composition" | "anchor" | "angle" | "character"; key: string; label: string; reason: string }[];
};

const HEAT = 5;

function toDistribution(counts: Map<string, number>, labelFor: (k: string) => string, total: number): Distribution {
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: labelFor(key), count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

function inc(m: Map<string, number>, k: string | null | undefined) {
  if (!k) return;
  m.set(k, (m.get(k) ?? 0) + 1);
}

/** Normalised Shannon entropy in 0..1: 1 means perfectly even, 0 means everything identical. */
export function evenness(counts: number[], categories: number): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 1 || categories <= 1) return total <= 1 ? 1 : 0;
  const h = counts.filter((c) => c > 0).reduce((acc, c) => acc - (c / total) * Math.log(c / total), 0);
  return Math.min(1, h / Math.log(Math.min(categories, total)));
}

const anchorLabel = (k: string) => k.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const presetLabel = (k: string) => COMPOSITION_PRESET_OPTIONS.find((o) => o.key === k)?.label ?? k;
const charLabel = (k: string) => CHARACTER_OPTIONS.find((o) => o.key === k)?.label ?? k;

export type InsightInput = Pick<Generation, "sceneSnapshot" | "reviewStatus" | "status">;

export function computeInsights(items: InsightInput[]): CollectionInsights {
  const scenes = items.map((i) => i.sceneSnapshot).filter((s): s is SceneContent => !!s);
  const heatmap = Array.from({ length: HEAT }, () => new Array<number>(HEAT).fill(0));
  const anchors = new Map<string, number>();
  const presets = new Map<string, number>();
  const angles = new Map<string, number>();
  const chars = new Map<string, number>();
  const envs = new Map<string, number>();
  const families = new Map<string, number>();
  const combos = new Map<string, number>();

  for (const s of scenes) {
    const c = s.composition;
    if (s.subject.kind !== "none") {
      const col = Math.min(HEAT - 1, Math.floor(c.x * HEAT));
      const row = Math.min(HEAT - 1, Math.floor(c.y * HEAT));
      heatmap[row][col]++;
      inc(anchors, c.anchor === "custom" ? nearestAnchor(c.x, c.y) : c.anchor);
    }
    inc(presets, c.preset ?? "none");
    inc(angles, c.cameraAngle);
    inc(chars, s.subject.kind);
    inc(envs, normaliseEnvironment(s.environment));
    const hexes = effectiveSwatches(s.palette);
    const dominant = [...new Set(hexes.map(hueFamily))].filter((f) => !["black", "white", "neutral"].includes(f))[0] ?? "neutral";
    inc(families, dominant);
    inc(combos, `${s.subject.kind}|${c.anchor === "custom" ? nearestAnchor(c.x, c.y) : c.anchor}|${c.preset ?? "none"}`);
  }

  const n = scenes.length;
  const accepted = items.filter((i) => i.reviewStatus === "accepted").length;
  const rejected = items.filter((i) => i.reviewStatus === "rejected").length;
  const reviewed = accepted + rejected;

  const repeatedPatterns = [...combos.entries()]
    .filter(([, count]) => count >= 3 || (n >= 4 && count / n >= 0.4))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, count]) => {
      const [ch, an, pr] = key.split("|");
      return {
        description: `${charLabel(ch)} at ${anchorLabel(an).toLowerCase()} with ${presetLabel(pr).toLowerCase()}`,
        count,
      };
    });

  const dominantAnchor = [...anchors.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dominantAnchor && n >= 4 && dominantAnchor[1] / n >= 0.4) {
    repeatedPatterns.unshift({
      description: `Subject placed ${anchorLabel(dominantAnchor[0]).toLowerCase()} in ${Math.round((dominantAnchor[1] / n) * 100)}% of images`,
      count: dominantAnchor[1],
    });
  }

  return {
    total: items.length,
    analysed: n,
    heatmap,
    anchors: toDistribution(anchors, anchorLabel, n),
    presets: toDistribution(presets, presetLabel, n),
    cameraAngles: toDistribution(angles, anchorLabel, n),
    characters: toDistribution(chars, charLabel, n),
    environments: toDistribution(envs, (k) => k, n),
    paletteFamilies: toDistribution(families, (k) => k[0].toUpperCase() + k.slice(1), n),
    acceptance: { accepted, rejected, unreviewed: items.length - reviewed, rate: reviewed ? accepted / reviewed : null },
    diversity: {
      character: evenness([...chars.values()], 18),
      environment: evenness([...envs.values()], 20),
      composition: evenness([...presets.values()], COMPOSITION_PRESETS.length),
      placement: evenness(heatmap.flat(), HEAT * HEAT),
      palette: evenness([...families.values()], 10),
    },
    repeatedPatterns,
    suggestions: suggestUnderused({ anchors, presets, angles, chars }, n),
  };
}

export function nearestAnchor(x: number, y: number): Exclude<Anchor, "custom"> {
  const col = x < 1 / 3 ? 0 : x < 2 / 3 ? 1 : 2;
  const row = y < 1 / 3 ? 0 : y < 2 / 3 ? 1 : 2;
  const grid: Exclude<Anchor, "custom">[][] = [
    ["upper-left", "upper-center", "upper-right"],
    ["middle-left", "center", "middle-right"],
    ["lower-left", "lower-center", "lower-right"],
  ];
  return grid[row][col];
}

function normaliseEnvironment(env: string) {
  const e = env.toLowerCase().replace(/^(an?|the)\s+/, "").trim();
  if (!e) return "unspecified";
  const words = e.split(/\s+/).filter((w) => w.length > 3 && !["with", "where", "beneath", "under", "above", "through"].includes(w));
  return words.slice(-1)[0] ?? e;
}

function suggestUnderused(
  m: { anchors: Map<string, number>; presets: Map<string, number>; angles: Map<string, number>; chars: Map<string, number> },
  n: number,
): CollectionInsights["suggestions"] {
  const out: CollectionInsights["suggestions"] = [];
  const unused = <K extends string>(all: readonly K[], used: Map<string, number>) =>
    [...all].sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0));

  for (const p of unused(COMPOSITION_PRESETS, m.presets).slice(0, 3)) {
    out.push({
      kind: "composition",
      key: p,
      label: presetLabel(p),
      reason: (m.presets.get(p) ?? 0) === 0 ? "Not yet used in this set" : `Used only ${m.presets.get(p)} of ${n} times`,
    });
  }
  const anchorKeys = ANCHORS.filter((a) => a !== "custom");
  for (const a of unused(anchorKeys, m.anchors).slice(0, 2)) {
    out.push({ kind: "anchor", key: a, label: anchorLabel(a), reason: (m.anchors.get(a) ?? 0) === 0 ? "No subjects placed here yet" : "Rarely used placement" });
  }
  for (const a of unused(CAMERA_ANGLES as readonly CameraAngle[], m.angles).slice(0, 1)) {
    out.push({ kind: "angle", key: a, label: anchorLabel(a), reason: "Least-used camera angle" });
  }
  return out;
}

/** Suggest a composition for a new scene based on what a set of scenes has underused. */
export function suggestComposition(scenes: SceneContent[]): { preset: CompositionPreset; anchor: Exclude<Anchor, "custom"> } {
  const insights = computeInsights(scenes.map((s) => ({ sceneSnapshot: s, reviewStatus: "unreviewed", status: "completed" })));
  const preset = (insights.suggestions.find((s) => s.kind === "composition")?.key ?? "rule-of-thirds") as CompositionPreset;
  const anchor = (insights.suggestions.find((s) => s.kind === "anchor")?.key ?? "upper-right") as Exclude<Anchor, "custom">;
  return { preset, anchor };
}
