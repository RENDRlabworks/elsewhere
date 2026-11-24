import {
  collectionItemsAddSchema,
  collectionItemsMoveSchema,
  collectionItemsRemoveSchema,
  collectionItemsReorderSchema,
} from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { addItems, moveItems, removeItems, reorderItems } from "@/lib/services/collections";

type P = { params: Promise<{ id: string }> };

/** Add images. */
export const POST = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const { generationIds } = await parseJson(req, collectionItemsAddSchema);
  return json(await addItems(ctx, id, generationIds));
});

/** Reorder: the full ordered list of item ids. */
export const PUT = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const { itemIds } = await parseJson(req, collectionItemsReorderSchema);
  await reorderItems(ctx, id, itemIds);
  return json({ ok: true });
});

/** Move items to another collection. */
export const PATCH = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const body = await parseJson(req, collectionItemsMoveSchema);
  return json(await moveItems(ctx, id, body.itemIds, body.targetCollectionId));
});

/** Remove items (the images stay in the archive). */
export const DELETE = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const { itemIds } = await parseJson(req, collectionItemsRemoveSchema);
  return json({ removed: await removeItems(ctx, id, itemIds) });
});
