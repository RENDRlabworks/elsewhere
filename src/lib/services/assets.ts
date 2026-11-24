import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Asset, AssetKind } from "@/lib/domain/schemas";
import { extractDominantColors } from "@/lib/palette/extract";
import { BUCKETS, type Bucket } from "@/lib/storage";
import type { ServerContext } from "@/lib/server/context";
import { badRequest } from "@/lib/server/http";

const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"]);
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const THUMB_EDGE = 768;

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

const bucketFor = (kind: AssetKind): Bucket =>
  kind === "generation" ? BUCKETS.generations : kind === "reference" ? BUCKETS.references : BUCKETS.imports;

/** Validate, analyse and store an image with a WebP thumbnail. */
export async function saveImageAsset(ctx: ServerContext, kind: AssetKind, data: Buffer, mimeType: string): Promise<Asset> {
  if (!ACCEPTED.has(mimeType)) throw badRequest(`Unsupported image type: ${mimeType}`);
  if (data.byteLength > MAX_UPLOAD_BYTES) throw badRequest("Images must be 25 MB or smaller");
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(data).metadata();
  } catch {
    throw badRequest("The file is not a readable image");
  }
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw badRequest("Could not read image dimensions");

  const id = randomUUID();
  const bucket = bucketFor(kind);
  const path = `${ctx.userId}/${id}.${EXT[mimeType] ?? "bin"}`;
  const thumbPath = `${ctx.userId}/${id}_thumb.webp`;
  const thumb = await sharp(data).rotate().resize(THUMB_EDGE, THUMB_EDGE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const { data: raw, info } = await sharp(data).resize(64, 64, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const dominantColors = extractDominantColors(new Uint8Array(raw), 5, info.channels);

  await ctx.storage.put(bucket, path, data, mimeType);
  await ctx.storage.put(bucket, thumbPath, thumb, "image/webp");
  try {
    return await ctx.db.table("assets").insert({
      id,
      kind,
      bucket,
      path,
      thumbPath,
      mimeType,
      width,
      height,
      bytes: data.byteLength,
      dominantColors,
    });
  } catch (err) {
    await ctx.storage.remove(bucket, [path, thumbPath]).catch(() => {});
    throw err;
  }
}

export async function readAsset(ctx: ServerContext, asset: Asset, variant: "full" | "thumb" = "full") {
  const p = variant === "thumb" && asset.thumbPath ? asset.thumbPath : asset.path;
  return ctx.storage.get(asset.bucket as Bucket, p);
}

export async function deleteAsset(ctx: ServerContext, assetId: string | null | undefined) {
  if (!assetId) return;
  const asset = await ctx.db.table("assets").get(assetId);
  if (!asset) return;
  await ctx.storage.remove(asset.bucket as Bucket, [asset.path, ...(asset.thumbPath ? [asset.thumbPath] : [])]);
  await ctx.db.table("assets").delete(asset.id);
}

export function assetUrl(assetId: string | null | undefined, variant: "full" | "thumb" = "thumb") {
  if (!assetId) return null;
  return `/api/assets/${assetId}${variant === "thumb" ? "?variant=thumb" : ""}`;
}

/** Read a file from a multipart form field with validation. */
export async function fileFromForm(form: FormData, field = "file"): Promise<{ data: Buffer; mimeType: string; name: string }> {
  const f = form.get(field);
  if (!f || typeof f === "string") throw badRequest(`Missing file field "${field}"`);
  if (f.size > MAX_UPLOAD_BYTES) throw badRequest("Images must be 25 MB or smaller");
  return { data: Buffer.from(await f.arrayBuffer()), mimeType: f.type || "application/octet-stream", name: f.name || "upload" };
}
