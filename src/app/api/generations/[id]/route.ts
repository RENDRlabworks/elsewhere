import { generationUpdateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, notFound, parseJson } from "@/lib/server/http";
import { deleteGenerationPermanently, updateGenerationMeta } from "@/lib/services/generations";

type P = { params: Promise<{ id: string }> };

/** Full detail for the inspector: lineage, collections, reviews and references. */
export const GET = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const gens = ctx.db.table("generations");
  const generation = await gens.get(id);
  if (!generation) throw notFound("Image");
  const rootId = generation.rootId ?? generation.id;
  const [lineage, items, reviews, references, parent] = await Promise.all([
    gens.list({ where: { rootId }, order: [{ field: "createdAt" }], limit: 100 }),
    ctx.db.table("collection_items").list({ where: { generationId: id } }),
    ctx.db.table("image_reviews").list({ where: { generationId: id }, order: [{ field: "createdAt", ascending: false }] }),
    generation.referenceIds.length ? ctx.db.table("reference_images").list({ where: { id: { in: generation.referenceIds } } }) : [],
    generation.parentId ? gens.get(generation.parentId) : null,
  ]);
  const root = generation.rootId ? await gens.get(generation.rootId) : generation;
  const collections = items.length
    ? await ctx.db.table("collections").list({ where: { id: { in: items.map((i) => i.collectionId) } } })
    : [];
  return json({
    generation,
    parent,
    lineage: [root, ...lineage].filter((g, i, a) => g && a.findIndex((x) => x?.id === g.id) === i),
    collections: collections.map((c) => ({ id: c.id, name: c.name })),
    reviews,
    references,
  });
});

export const PATCH = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  return json({ generation: await updateGenerationMeta(ctx, id, await parseJson(req, generationUpdateSchema)) });
});

/** Permanent deletion. Rejecting an image is a PATCH of reviewStatus and never deletes it. */
export const DELETE = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  await deleteGenerationPermanently(await getContext(), id);
  return json({ ok: true });
});
