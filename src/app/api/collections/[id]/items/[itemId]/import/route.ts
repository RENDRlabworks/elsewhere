import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";
import { importOriginal } from "@/lib/services/collections";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) => {
  const { id, itemId } = await params;
  const ctx = await getContext();
  return json(await importOriginal(ctx, id, itemId, await req.formData()), { status: 201 });
});
