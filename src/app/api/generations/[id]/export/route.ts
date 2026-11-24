import { getContext } from "@/lib/server/context";
import { handle, notFound } from "@/lib/server/http";
import { exportFilename } from "@/lib/share/presets";
import { exportOptionsFromQuery, renderExport } from "@/lib/services/share";

export const maxDuration = 60;

/** One image cropped, resized and encoded for posting. ?crop=4:5&size=web&format=jpeg&fx=0.5&fy=0.5 */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const url = new URL(req.url);
  const opts = exportOptionsFromQuery(url.searchParams);
  const ctx = await getContext();
  const g = await ctx.db.table("generations").get(id);
  if (!g) throw notFound("Image");
  const out = await renderExport(ctx, g, opts);
  const name = exportFilename(g.title, opts);
  return new Response(new Uint8Array(out.buffer), {
    headers: {
      "Content-Type": out.mime,
      "Content-Disposition": `${url.searchParams.get("inline") ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Image-Width": String(out.width),
      "X-Image-Height": String(out.height),
    },
  });
});
