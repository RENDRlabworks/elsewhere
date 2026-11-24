import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getContext();
  await ctx.db.table("palettes").delete(id);
  return json({ ok: true });
});
