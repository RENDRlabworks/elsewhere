import { patchOf, promptTemplateCreateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, notFound, parseJson } from "@/lib/server/http";

type P = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  if (!(await ctx.db.table("prompt_templates").get(id))) throw notFound("Template");
  const patch = await parseJson(req, patchOf(promptTemplateCreateSchema));
  return json({ template: await ctx.db.table("prompt_templates").update(id, patch) });
});

export const DELETE = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  await ctx.db.table("prompt_templates").delete(id);
  await ctx.db.table("scenes").updateWhere({ promptTemplateId: id }, { promptTemplateId: null });
  return json({ ok: true });
});
