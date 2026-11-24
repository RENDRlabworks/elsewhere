import "server-only";
import sharp from "sharp";
import { z } from "zod";
import type { Generation } from "@/lib/domain/schemas";
import { structuredCompletion, textAssistAvailable } from "@/lib/providers/text";
import type { ServerContext } from "@/lib/server/context";
import { badRequest, notFound } from "@/lib/server/http";
import {
  CROP_KEYS,
  cropRect,
  defaultFocus,
  type ExportOptions,
  FORMAT_KEYS,
  FORMATS,
  outputSize,
  type ShareText,
  SIZE_KEYS,
  templateShareText,
  tidyCopy,
} from "@/lib/share/presets";
import type { Bucket } from "@/lib/storage";
import { getPreferences } from "./generations";

export const exportOptionsSchema = z.object({
  crop: z.enum(CROP_KEYS).default("original"),
  size: z.enum(SIZE_KEYS).default("web"),
  format: z.enum(FORMAT_KEYS).default("jpeg"),
  focusX: z.coerce.number().min(0).max(1).optional(),
  focusY: z.coerce.number().min(0).max(1).optional(),
});

/** Read export options from a query string (crop, size, format, fx, fy). */
export function exportOptionsFromQuery(params: URLSearchParams): ExportOptions {
  const res = exportOptionsSchema.safeParse({
    crop: params.get("crop") ?? undefined,
    size: params.get("size") ?? undefined,
    format: params.get("format") ?? undefined,
    focusX: params.get("fx") ?? undefined,
    focusY: params.get("fy") ?? undefined,
  });
  if (!res.success) throw badRequest("Unknown crop, size or format");
  return res.data;
}

async function originalBytes(ctx: ServerContext, g: Generation) {
  if (!g.assetId) throw notFound("Image file");
  const asset = await ctx.db.table("assets").get(g.assetId);
  const data = asset ? await ctx.storage.get(asset.bucket as Bucket, asset.path) : null;
  if (!asset || !data) throw notFound("Image file");
  return { asset, data: Buffer.from(data) };
}

/** Crop, resize and encode an image for posting. Colour is converted to sRGB and metadata stripped. */
export async function renderExport(ctx: ServerContext, g: Generation, opts: ExportOptions) {
  const { data } = await originalBytes(ctx, g);
  const base = sharp(data).rotate();
  const meta = await base.metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  if (!width || !height) throw badRequest("Could not read image dimensions");
  const focus = defaultFocus(g);
  const rect = cropRect(width, height, opts.crop, opts.focusX ?? focus.x, opts.focusY ?? focus.y);
  const out = outputSize(rect.width, rect.height, opts.size);

  let img = base.extract(rect);
  if (out.width !== rect.width || out.height !== rect.height) {
    img = img.resize(out.width, out.height, { kernel: "lanczos3", fit: "fill" });
    // A light sharpen offsets the softness of resampling, more when enlarging.
    img = img.sharpen(out.upscaled ? { sigma: 0.9, m1: 0.6, m2: 1.4 } : { sigma: 0.5, m1: 0.4, m2: 0.8 });
  }
  img = img.toColorspace("srgb");
  const format = FORMATS.find((f) => f.key === opts.format)!;
  const buffer =
    opts.format === "jpeg"
      ? await img.flatten({ background: "#000000" }).jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer()
      : opts.format === "webp"
        ? await img.webp({ quality: 90, smartSubsample: true }).toBuffer()
        : await img.png({ compressionLevel: 8 }).toBuffer();
  return { buffer, mime: format.mime, width: out.width, height: out.height, upscaled: out.upscaled };
}

/* -------------------------------------------------------------------------- */
/* Caption and alt text                                                       */
/* -------------------------------------------------------------------------- */

const shareTextOutput = z.object({
  caption: z.string().describe("A short caption for posting the image. One or two lines."),
  altText: z.string().describe("Alt text describing what the image shows, for people who cannot see it."),
});

const shareState = globalThis as unknown as { __elsewhereShareTextOff?: boolean };

/** Keep caption and alt text on the image. Best effort until the share text migration has run. */
async function saveShareText(ctx: ServerContext, id: string, text: ShareText) {
  if (shareState.__elsewhereShareTextOff) return false;
  try {
    await ctx.db.table("generations").update(id, { shareText: text } as Partial<Generation>);
    return true;
  } catch (err) {
    if (/share_text|shareText/i.test(err instanceof Error ? err.message : String(err))) {
      shareState.__elsewhereShareTextOff = true;
      console.warn("[elsewhere] captions are not saved: run the share text migration in Supabase to keep them.");
      return false;
    }
    throw err;
  }
}

async function getGeneration(ctx: ServerContext, id: string) {
  const g = await ctx.db.table("generations").get(id);
  if (!g) throw notFound("Image");
  return g;
}

/** Saved caption and alt text, or a draft written from the scene. */
export async function getShareText(ctx: ServerContext, id: string) {
  const g = await getGeneration(ctx, id);
  const saved = g.shareText ?? null;
  const text: ShareText = saved ?? { ...templateShareText(g), source: "template", updatedAt: g.updatedAt };
  return { ...text, saved: !!saved, aiAvailable: textAssistAvailable() };
}

export async function updateShareText(ctx: ServerContext, id: string, input: { caption: string; altText: string }) {
  await getGeneration(ctx, id);
  const text: ShareText = { caption: input.caption.trim(), altText: input.altText.trim(), source: "edited", updatedAt: new Date().toISOString() };
  const saved = await saveShareText(ctx, id, text);
  return { ...text, saved, aiAvailable: textAssistAvailable() };
}

/** Write caption and alt text by looking at the image, or from the scene when AI assistance is off. */
export async function writeShareText(ctx: ServerContext, id: string) {
  const g = await getGeneration(ctx, id);
  let text: ShareText;
  if (textAssistAvailable() && g.assetId) {
    const { data } = await originalBytes(ctx, g);
    const small = await sharp(data).rotate().resize(1024, 1024, { fit: "inside" }).webp({ quality: 85 }).toBuffer();
    const prefs = await getPreferences(ctx);
    const draft = templateShareText(g);
    const res = await structuredCompletion({
      schema: shareTextOutput,
      name: "elsewhere_share_text",
      model: prefs.defaults.textModel,
      images: [{ data: small, mimeType: "image/webp" }],
      system: [
        "You write the words that go with a fine-art image when an artist posts it to their portfolio, X, Threads or Bluesky.",
        "Alt text: describe what is visibly in the image for someone who cannot see it. Name the medium first (for example a painting or a photograph), then the subject, where it is, the impossible or surprising element, the light and the main colours. Plain, concrete words. One to three sentences, under 400 characters. Never start with 'Image of' or 'Picture of'.",
        "Caption: quiet and spare, in the artist's voice. The title on its own line, then at most one short line that adds feeling rather than repeating the alt text. No hashtags, no emoji, no exclamation marks, no em dashes, no quotation marks around the title.",
      ].join("\n"),
      user: [
        `Title: ${g.title}`,
        g.sceneSnapshot?.description ? `Artist's description: ${g.sceneSnapshot.description}` : "",
        g.styleSnapshot?.attributes.medium ? `Medium: ${g.styleSnapshot.attributes.medium}` : "",
        `Scene notes, for facts only: ${draft.altText}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    await ctx.db.table("usage_records").insert({
      jobId: null,
      generationId: g.id,
      provider: "openai",
      model: res.model,
      kind: "text",
      images: 0,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      costUsd: null,
      estimated: true,
    });
    text = {
      caption: tidyCopy(res.data.caption).replace(/ ?\n ?/g, "\n").replace(/!/g, "."),
      altText: tidyCopy(res.data.altText).slice(0, 1000),
      source: "ai",
      updatedAt: new Date().toISOString(),
    };
  } else {
    text = { ...templateShareText(g), source: "template", updatedAt: new Date().toISOString() };
  }
  const saved = await saveShareText(ctx, id, text);
  return { ...text, saved, aiAvailable: textAssistAvailable() };
}
