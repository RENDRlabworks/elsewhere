import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";
import { aiReview } from "@/lib/services/assist";

export const maxDuration = 120;

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return json({ review: await aiReview(await getContext(), id) }, { status: 201 });
});
