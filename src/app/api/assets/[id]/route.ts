import { NextResponse } from "next/server";
import { getContext } from "@/lib/server/context";
import { handle, notFound } from "@/lib/server/http";
import { streamBytes } from "@/lib/server/stream";
import type { Bucket } from "@/lib/storage";

/**
 * Serve a private image to its owner. Supabase mode redirects to a short-lived
 * signed URL; local mode streams the file. Assets are immutable, so the
 * response is cacheable privately.
 */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const url = new URL(req.url);
  const thumb = url.searchParams.get("variant") === "thumb";
  const download = url.searchParams.get("download") === "1";
  const ctx = await getContext();
  const asset = await ctx.db.table("assets").get(id);
  if (!asset) throw notFound("Image");
  const path = thumb && asset.thumbPath ? asset.thumbPath : asset.path;
  const filename = url.searchParams.get("filename")?.replace(/[^\w.-]+/g, "-") || path.split("/").pop()!;

  if (!download) {
    const signed = await ctx.storage.signedUrl(asset.bucket as Bucket, path, 3600);
    if (signed) return NextResponse.redirect(signed, { headers: { "Cache-Control": "private, max-age=3000" } });
  }
  const data = await ctx.storage.get(asset.bucket as Bucket, path);
  if (!data) throw notFound("Image file");
  return new NextResponse(streamBytes(data), {
    headers: {
      "Content-Type": thumb ? "image/webp" : asset.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
      ...(download ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
    },
  });
});
