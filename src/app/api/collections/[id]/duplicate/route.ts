import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";
import { duplicateCollection } from "@/lib/services/collections";

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return json({ collection: await duplicateCollection(await getContext(), id) }, { status: 201 });
});
