"use client";

/**
 * The hosting platform rejects requests over 4.5 MB, and a pasted screenshot or a phone
 * photo is often larger. Images are scaled and re-encoded in the browser to stay under
 * the limit before they are sent. Small files pass through untouched.
 */

const LIMIT_BYTES = 4_000_000; // headroom under 4.5 MB for the rest of the form
const PASS_THROUGH = new Set(["image/png", "image/jpeg", "image/webp"]);

async function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function fitForUpload(file: File, opts: { maxEdge?: number } = {}): Promise<File> {
  const maxEdge = opts.maxEdge ?? 3072;
  if (file.size <= LIMIT_BYTES && PASS_THROUGH.has(file.type)) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // let the server explain what it cannot read

  const long = Math.max(bitmap.width, bitmap.height);
  let edge = Math.min(maxEdge, long);
  let quality = 0.92;
  const canvas = document.createElement("canvas");
  const base = file.name.replace(/\.[^.]+$/, "") || "image";

  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = edge / long;
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // WebP keeps transparency and compresses well; browsers that cannot encode it fall back to JPEG.
    let blob = await encode(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
      blob = await encode(canvas, "image/jpeg", quality);
    }
    if (blob && blob.size <= LIMIT_BYTES) {
      bitmap.close();
      return new File([blob], `${base}.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type });
    }
    edge = Math.round(edge * 0.8);
    quality = Math.max(0.7, quality - 0.06);
  }
  bitmap.close();
  return file;
}
