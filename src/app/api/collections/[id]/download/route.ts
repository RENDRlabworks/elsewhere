import type { Generation } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle } from "@/lib/server/http";
import { getCollectionDetail, zipGenerations } from "@/lib/services/collections";
import { exportOptionsFromQuery } from "@/lib/services/share";

export const maxDuration = 120;

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const query = new URL(req.url).searchParams;
  const opts = query.has("crop") ? exportOptionsFromQuery(query) : null;
  const ctx = await getContext();
  const { collection, items } = await getCollectionDetail(ctx, id);
  const zip = await zipGenerations(ctx, items.map((i) => i.generation).filter((g): g is Generation => !!g?.assetId), opts);
  const name = collection.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "collection";
  return new Response(new Uint8Array(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}.zip"` },
  });
});
