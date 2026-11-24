import { collectionCreateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { createCollection, listCollections } from "@/lib/services/collections";

export const GET = handle(async () => json({ collections: await listCollections(await getContext()) }));

export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  return json({ collection: await createCollection(ctx, await parseJson(req, collectionCreateSchema)) }, { status: 201 });
});
