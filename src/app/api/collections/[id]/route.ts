import { collectionUpdateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { deleteCollection, getCollectionDetail, updateCollection } from "@/lib/services/collections";

type P = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  return json(await getCollectionDetail(await getContext(), id));
});

export const PATCH = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  return json({ collection: await updateCollection(ctx, id, await parseJson(req, collectionUpdateSchema)) });
});

/** Deletes the collection and its ordering only. Images remain in the archive. */
export const DELETE = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  await deleteCollection(await getContext(), id);
  return json({ ok: true });
});
