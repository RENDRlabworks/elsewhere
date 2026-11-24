import { referenceUpdateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, notFound, parseJson } from "@/lib/server/http";
import { deleteAssetIfUnused } from "@/lib/services/references";

type P = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  if (!(await ctx.db.table("reference_images").get(id))) throw notFound("Reference");
  return json({ reference: await ctx.db.table("reference_images").update(id, await parseJson(req, referenceUpdateSchema)) });
});

export const DELETE = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const ref = await ctx.db.table("reference_images").get(id);
  if (!ref) throw notFound("Reference");
  // Generations keep the reference id in their immutable snapshot. The file is removed only
  // when nothing else uses it: references made from originals share the original's file.
  await ctx.db.table("reference_images").delete(id);
  await deleteAssetIfUnused(ctx, ref.assetId);
  return json({ ok: true });
});
