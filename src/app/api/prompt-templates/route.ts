import { promptTemplateCreateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";

export const GET = handle(async () => {
  const ctx = await getContext();
  return json({ templates: await ctx.db.table("prompt_templates").list({ order: [{ field: "updatedAt", ascending: false }] }) });
});

export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  const template = await ctx.db.table("prompt_templates").insert(await parseJson(req, promptTemplateCreateSchema));
  return json({ template }, { status: 201 });
});
