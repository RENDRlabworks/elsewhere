import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";
import { collectionInsights } from "@/lib/services/collections";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return json({ insights: await collectionInsights(await getContext(), id) });
});
