import type { AspectRatio, Quality } from "@/lib/domain/vocab";
import type { ImageCapabilities, ImageModelConfig, ImagePricing, SizeRules } from "./types";

/**
 * Model registry. Values follow the OpenAI image generation reference as of
 * November 2026 (gpt-image-1 was retired on 23 October 2026). Update this file,
 * not call sites, when provider capabilities change. Any model ID not listed
 * here can still be used via settings or OPENAI_IMAGE_MODEL; it then runs with
 * conservative, clearly flagged defaults.
 */

const FLEXIBLE: SizeRules = {
  mode: "flexible",
  multiple: 16,
  minPixels: 655_360,
  maxPixels: 8_294_400,
  maxEdge: 3840,
  minRatio: 1 / 3,
  maxRatio: 3,
  experimentalAbovePixels: 2560 * 1440,
};

const STANDARD_SIZES: SizeRules = {
  mode: "fixed",
  options: [
    { width: 1024, height: 1024 },
    { width: 1536, height: 1024 },
    { width: 1024, height: 1536 },
  ],
};

const FORMATS: ImageCapabilities["formats"] = ["png", "webp", "jpeg"];
const MAX_REFS = 16;

const caps = (over: Partial<ImageCapabilities>): ImageCapabilities => ({
  textToImage: true,
  referenceImages: true,
  maxReferenceImages: MAX_REFS,
  editing: true,
  sizes: FLEXIBLE,
  qualities: ["auto", "low", "medium", "high"],
  formats: FORMATS,
  transparency: false,
  maxImagesPerRequest: 4,
  ...over,
});

const TOKEN_25: ImagePricing = { kind: "per-token", imageOutputPerM: 30, imageInputPerM: 8, textInputPerM: 5 };
const TOKEN_26: ImagePricing = { kind: "per-token", imageOutputPerM: 30 };

export const OPENAI_IMAGE_MODELS: ImageModelConfig[] = [
  {
    id: "gpt-image-2.6-flare",
    label: "GPT Image 2.6 Flare",
    description: "Fast, high-quality everyday generation. Recommended default.",
    provider: "openai",
    recommended: true,
    capabilities: caps({ qualities: ["auto", "low", "medium", "high", "xhigh", "max"], transparency: true }),
    pricing: TOKEN_26,
  },
  {
    id: "gpt-image-2.6-sunburst",
    label: "GPT Image 2.6 Sunburst",
    description: "Best when editing precision matters most: refinements and variations.",
    provider: "openai",
    capabilities: caps({ qualities: ["auto", "low", "medium", "high", "xhigh", "max"], transparency: true }),
    pricing: TOKEN_26,
  },
  {
    id: "gpt-image-2.5-flare",
    label: "GPT Image 2.5 Flare",
    description: "Previous-generation fast model.",
    provider: "openai",
    capabilities: caps({ qualities: ["auto", "low", "medium", "high", "xhigh", "max"], transparency: true }),
    pricing: TOKEN_25,
  },
  {
    id: "gpt-image-2.5-sunburst",
    label: "GPT Image 2.5 Sunburst",
    description: "Previous-generation precise editing model.",
    provider: "openai",
    capabilities: caps({ qualities: ["auto", "low", "medium", "high", "xhigh", "max"], transparency: true }),
    pricing: TOKEN_25,
  },
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    description: "Flexible sizes, three quality tiers. Transparency is in preview and not offered here.",
    provider: "openai",
    capabilities: caps({}),
    pricing: {
      kind: "per-image",
      table: {
        low: { "1024x1024": 0.006, "1024x1536": 0.005, "1536x1024": 0.005 },
        medium: { "1024x1024": 0.053, "1024x1536": 0.041, "1536x1024": 0.041 },
        high: { "1024x1024": 0.211, "1024x1536": 0.165, "1536x1024": 0.165 },
      },
    },
  },
  {
    id: "gpt-image-1.5",
    label: "GPT Image 1.5",
    description: "Older model with standard sizes and input fidelity control.",
    provider: "openai",
    capabilities: caps({ sizes: STANDARD_SIZES, supportsInputFidelity: true, transparency: true }),
  },
  {
    id: "gpt-image-1-mini",
    label: "GPT Image 1 Mini",
    description: "Low-cost drafts at standard sizes.",
    provider: "openai",
    capabilities: caps({ sizes: STANDARD_SIZES, transparency: true }),
    pricing: {
      kind: "per-image",
      table: {
        low: { "1024x1024": 0.005, "1024x1536": 0.006, "1536x1024": 0.006 },
        medium: { "1024x1024": 0.011, "1024x1536": 0.015, "1536x1024": 0.015 },
        high: { "1024x1024": 0.036, "1024x1536": 0.052, "1536x1024": 0.052 },
      },
    },
  },
];

export function unverifiedModel(id: string, provider = "openai"): ImageModelConfig {
  return {
    id,
    label: id,
    description: "Not in Elsewhere's model registry. Using conservative settings; verify capabilities in the provider documentation.",
    provider,
    unverified: true,
    capabilities: caps({ sizes: STANDARD_SIZES, maxImagesPerRequest: 1 }),
  };
}

export function ratioOf(aspect: AspectRatio): number {
  const [w, h] = aspect.split(":").map(Number);
  return w / h;
}

export type ResolvedSize = { width: number; height: number; adjusted: boolean; notes: string[] };

/** Map an aspect ratio and long edge to dimensions the model supports. */
export function resolveSize(rules: SizeRules, aspect: AspectRatio, longEdge: number): ResolvedSize {
  const notes: string[] = [];
  let ratio = ratioOf(aspect);
  if (rules.mode === "fixed") {
    const best = [...rules.options].sort(
      (a, b) => Math.abs(Math.log(a.width / a.height / ratio)) - Math.abs(Math.log(b.width / b.height / ratio)),
    )[0];
    const adjusted = Math.abs(best.width / best.height - ratio) > 0.01;
    if (adjusted) notes.push(`This model only supports fixed sizes; ${aspect} is mapped to ${best.width}×${best.height}.`);
    if (Math.max(best.width, best.height) !== longEdge) notes.push(`Long edge set to ${Math.max(best.width, best.height)}px.`);
    return { ...best, adjusted: adjusted || Math.max(best.width, best.height) !== longEdge, notes };
  }
  if (ratio > rules.maxRatio || ratio < rules.minRatio) {
    ratio = Math.min(rules.maxRatio, Math.max(rules.minRatio, ratio));
    notes.push("Aspect ratio clamped to the provider's 1:3 to 3:1 range.");
  }
  let edge = Math.min(longEdge, rules.maxEdge);
  const dims = (e: number) => {
    const w = ratio >= 1 ? e : e * ratio;
    const h = ratio >= 1 ? e / ratio : e;
    const m = rules.multiple;
    return { width: Math.max(m, Math.round(w / m) * m), height: Math.max(m, Math.round(h / m) * m) };
  };
  let d = dims(edge);
  let guard = 0;
  while (d.width * d.height > rules.maxPixels && guard++ < 200) d = dims((edge -= rules.multiple));
  guard = 0;
  while (d.width * d.height < rules.minPixels && guard++ < 400) d = dims((edge += rules.multiple));
  if (edge !== longEdge) notes.push(`Long edge adjusted to ${Math.max(d.width, d.height)}px to meet provider pixel limits.`);
  if (rules.experimentalAbovePixels && d.width * d.height > rules.experimentalAbovePixels) {
    notes.push("Resolutions above 2560×1440 are marked experimental by the provider.");
  }
  return { ...d, adjusted: notes.length > 0, notes };
}

export function supportedQuality(model: ImageModelConfig, q: Quality): { quality: Quality; note?: string } {
  if (model.capabilities.qualities.includes(q)) return { quality: q };
  const fallback = model.capabilities.qualities.includes("high") ? "high" : model.capabilities.qualities[0];
  return { quality: fallback, note: `${model.label} does not support "${q}" quality; using "${fallback}".` };
}

/** Pre-generation estimate. Returns null when no reliable per-image price is known. */
export function estimateCost(model: ImageModelConfig, quality: Quality, width: number, height: number, n: number): number | null {
  if (model.pricing?.kind !== "per-image") return null;
  const q = quality === "auto" ? "high" : quality;
  const table = model.pricing.table[q];
  if (!table) return null;
  const exact = table[`${width}x${height}`];
  if (exact != null) return exact * n;
  // Scale the nearest standard size by pixel count; still an estimate.
  const orient = width === height ? "1024x1024" : width > height ? "1536x1024" : "1024x1536";
  const base = table[orient];
  if (base == null) return null;
  const [bw, bh] = orient.split("x").map(Number);
  return base * ((width * height) / (bw * bh)) * n;
}

/** Actual cost from reported token usage, when per-token pricing is known. */
export function costFromUsage(
  model: ImageModelConfig,
  usage: { imageOutputTokens?: number; outputTokens?: number; imageInputTokens?: number; textInputTokens?: number; inputTokens?: number } | undefined,
): { cost: number | null; estimated: boolean } {
  if (!usage || model.pricing?.kind !== "per-token") return { cost: null, estimated: true };
  const p = model.pricing;
  const out = (usage.imageOutputTokens ?? usage.outputTokens ?? 0) * p.imageOutputPerM;
  let cost = out;
  let estimated = false;
  if ((usage.imageInputTokens ?? 0) > 0) {
    if (p.imageInputPerM != null) cost += usage.imageInputTokens! * p.imageInputPerM;
    else estimated = true;
  }
  if ((usage.textInputTokens ?? 0) > 0) {
    if (p.textInputPerM != null) cost += usage.textInputTokens! * p.textInputPerM;
    else estimated = true;
  }
  return { cost: cost / 1_000_000, estimated };
}

export function qualityLabel(q: Quality) {
  return q === "xhigh" ? "Extra high" : q[0].toUpperCase() + q.slice(1);
}
