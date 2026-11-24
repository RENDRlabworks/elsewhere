import { savedPaletteCreateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";

export const GET = handle(async () => {
  const ctx = await getContext();
  return json({ palettes: await ctx.db.table("palettes").list({ order: [{ field: "updatedAt", ascending: false }] }) });
});

export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  return json({ palette: await ctx.db.table("palettes").insert(await parseJson(req, savedPaletteCreateSchema)) }, { status: 201 });
});
