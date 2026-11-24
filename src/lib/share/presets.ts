import type { Generation } from "@/lib/domain/schemas";
import { CHARACTER_NOUNS } from "@/lib/domain/vocab";

/**
 * Export settings for sharing an image: crop, size and file format, plus the
 * caption and alt text that go with it. Pure, so the preview in the browser and
 * the render on the server agree on exactly the same crop.
 */

export const CROP_PRESETS = [
  { key: "original", label: "Original", ratio: null, hint: "Full frame" },
  { key: "4:5", label: "4:5", ratio: 4 / 5, hint: "Instagram, Threads" },
  { key: "1:1", label: "1:1", ratio: 1, hint: "Square" },
  { key: "9:16", label: "9:16", ratio: 9 / 16, hint: "Stories" },
  { key: "16:9", label: "16:9", ratio: 16 / 9, hint: "X, Bluesky, wide" },
  { key: "3:2", label: "3:2", ratio: 3 / 2, hint: "Portfolio" },
] as const;
export type CropKey = (typeof CROP_PRESETS)[number]["key"];
export const CROP_KEYS = CROP_PRESETS.map((c) => c.key) as [CropKey, ...CropKey[]];

export const SIZE_PRESETS = [
  { key: "social", label: "Social", hint: "1080 px on the short edge" },
  { key: "web", label: "Web", hint: "2048 px on the long edge" },
  { key: "original", label: "Original", hint: "Full resolution" },
  { key: "large", label: "Large", hint: "4096 px, enlarged if needed" },
] as const;
export type SizeKey = (typeof SIZE_PRESETS)[number]["key"];
export const SIZE_KEYS = SIZE_PRESETS.map((s) => s.key) as [SizeKey, ...SizeKey[]];

export const FORMATS = [
  { key: "jpeg", label: "JPEG", ext: "jpg", mime: "image/jpeg" },
  { key: "webp", label: "WebP", ext: "webp", mime: "image/webp" },
  { key: "png", label: "PNG", ext: "png", mime: "image/png" },
] as const;
export type FormatKey = (typeof FORMATS)[number]["key"];
export const FORMAT_KEYS = FORMATS.map((f) => f.key) as [FormatKey, ...FormatKey[]];

export type ExportOptions = {
  crop: CropKey;
  size: SizeKey;
  format: FormatKey;
  /** Where the crop window sits, 0 to 1 along each axis of the free space. */
  focusX?: number;
  focusY?: number;
};

export const DEFAULT_EXPORT: ExportOptions = { crop: "original", size: "web", format: "jpeg" };

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));

/**
 * The default crop position keeps the subject where the composition put it: a fox a
 * fifth of the way across the frame stays a fifth of the way across the crop.
 */
export function defaultFocus(g: Pick<Generation, "sceneSnapshot">) {
  const c = g.sceneSnapshot?.composition;
  return { x: clamp01(c?.x ?? 0.5), y: clamp01(c?.y ?? 0.5) };
}

export function cropRatio(crop: CropKey) {
  return CROP_PRESETS.find((c) => c.key === crop)?.ratio ?? null;
}

/** Crop rectangle in source pixels. */
export function cropRect(width: number, height: number, crop: CropKey, focusX = 0.5, focusY = 0.5) {
  const ratio = cropRatio(crop);
  if (!ratio) return { left: 0, top: 0, width, height };
  const w = Math.min(width, Math.round(height * ratio));
  const h = Math.min(height, Math.round(width / ratio));
  return {
    left: Math.round(clamp01(focusX) * (width - w)),
    top: Math.round(clamp01(focusY) * (height - h)),
    width: w,
    height: h,
  };
}

/** Output dimensions for a crop of the given size. Never zero. */
export function outputSize(cropW: number, cropH: number, size: SizeKey) {
  const long = Math.max(cropW, cropH);
  const short = Math.min(cropW, cropH);
  const scale =
    size === "original" ? 1 : size === "social" ? Math.min(1, 1080 / short) : size === "web" ? Math.min(1, 2048 / long) : 4096 / long;
  return { width: Math.max(1, Math.round(cropW * scale)), height: Math.max(1, Math.round(cropH * scale)), upscaled: scale > 1 };
}

export function exportFilename(title: string, opts: Pick<ExportOptions, "crop" | "format">) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "elsewhere";
  const ext = FORMATS.find((f) => f.key === opts.format)?.ext ?? "jpg";
  return `${base}${opts.crop === "original" ? "" : `-${opts.crop.replace(":", "x")}`}.${ext}`;
}

export function exportQuery(opts: ExportOptions) {
  const p = new URLSearchParams({ crop: opts.crop, size: opts.size, format: opts.format });
  if (opts.focusX != null) p.set("fx", opts.focusX.toFixed(3));
  if (opts.focusY != null) p.set("fy", opts.focusY.toFixed(3));
  return p.toString();
}

/* -------------------------------------------------------------------------- */
/* Caption and alt text                                                       */
/* -------------------------------------------------------------------------- */

export type ShareText = { caption: string; altText: string; source: "ai" | "template" | "edited"; updatedAt: string };

/** Copy rules for anything Elsewhere writes for posting: no em or en dashes, single spaces. */
export function tidyCopy(s: string) {
  return s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]+/g, " ")
    .replace(/ +([.,;:])/g, "$1")
    .trim();
}

function mediumPhrase(medium: string | undefined) {
  const m = (medium ?? "").toLowerCase();
  if (/photograph/.test(m) && !/not a photograph/.test(m)) return "A photograph";
  if (/monochrome|graphite|mezzotint|black and white/.test(m)) return "A monochrome illustration";
  if (/paint|illustration|nocturne/.test(m)) return "A painting";
  return "An image";
}

/** Plain colour words for a hex value, for alt text. */
export function colourName(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.1) return "black";
  if (l > 0.93) return "white";
  if (s < 0.14) return l < 0.35 ? "charcoal" : l < 0.7 ? "grey" : "pale grey";
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const hue =
    h < 15 || h >= 345 ? "red" : h < 40 ? "orange" : h < 55 ? "amber" : h < 70 ? "yellow" : h < 160 ? "green" : h < 195 ? "teal" : h < 250 ? "blue" : h < 290 ? "violet" : "pink";
  const named = hue === "orange" && l < 0.4 ? "brown" : hue;
  return l < 0.3 ? `deep ${named}` : l > 0.75 ? `pale ${named}` : named;
}

function paletteWords(hexes: string[]) {
  const words: string[] = [];
  for (const h of hexes) {
    const w = colourName(h);
    if (w && !words.includes(w)) words.push(w);
    if (words.length === 3) break;
  }
  if (!words.length) return "";
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

function sentence(s: string) {
  const t = s.trim().replace(/[.\s]+$/, "");
  return t ? `${t[0].toUpperCase()}${t.slice(1)}.` : "";
}

const lower = (s: string) => (s ? `${s[0].toLowerCase()}${s.slice(1)}` : s);

/**
 * Caption and alt text written from the scene that made the image. Used when AI
 * assistance is off, and as a starting point the user can edit.
 */
export function templateShareText(
  g: Pick<Generation, "title" | "sceneSnapshot" | "styleSnapshot" | "paletteHexes" | "environment">,
): Pick<ShareText, "caption" | "altText"> {
  const s = g.sceneSnapshot;
  const medium = mediumPhrase(g.styleSnapshot?.attributes.medium);
  const parts: string[] = [];
  if (s && s.subject.kind !== "none") {
    const noun = s.subject.label || CHARACTER_NOUNS[s.subject.kind]?.[0] || "figure";
    const hasArticle = /^(a|an|the)\s/i.test(noun);
    const small = s.subject.relationship === "dwarfed" && !hasArticle && !/\b(small|tiny|lone|little)\b/i.test(noun);
    const who = hasArticle ? noun : small ? `a small ${noun}` : `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
    parts.push(`of ${s.subject.count > 1 ? `${s.subject.count} ${CHARACTER_NOUNS[s.subject.kind]?.[1] ?? noun}` : who}`);
    if (s.subject.action) parts.push(lower(s.subject.action));
  } else {
    parts.push("of an empty landscape");
  }
  const env = s?.environment || g.environment;
  if (env) parts.push(`in ${lower(env.replace(/^(in|on|at)\s+/i, ""))}`);
  let alt = `${medium} ${parts.join(", ")}.`;
  if (s?.phenomenon) alt += ` ${sentence(s.phenomenon)}`;
  const light = [s?.lighting, s?.atmosphere].filter(Boolean).join(", ");
  if (light) alt += ` ${sentence(light)}`;
  const colours = paletteWords(g.paletteHexes ?? []);
  if (colours) alt += ` Mostly ${colours}.`;

  const line = s?.description?.trim() || (s?.phenomenon ? sentence(s.phenomenon) : "");
  const caption = [g.title.trim(), line.length > 220 ? `${line.slice(0, 217).replace(/\s+\S*$/, "")}...` : line].filter(Boolean).join("\n\n");
  return { caption: tidyCopy(caption).replace(/ ?\n ?/g, "\n"), altText: tidyCopy(alt).slice(0, 1000) };
}
