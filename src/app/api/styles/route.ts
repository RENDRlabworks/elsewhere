import { styleProfileCreateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { createStyleProfile } from "@/lib/services/styles";

export const GET = handle(async () => {
  const ctx = await getContext();
  return json({ profiles: await ctx.db.table("style_profiles").list({ order: [{ field: "createdAt" }] }) });
});

export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  const body = await parseJson(req, styleProfileCreateSchema);
  return json({ profile: await createStyleProfile(ctx, body) }, { status: 201 });
});
