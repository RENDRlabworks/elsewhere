import { promptVersionCreateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, notFound, parseJson } from "@/lib/server/http";

type P = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const versions = await ctx.db.table("prompt_versions").list({
    where: { sceneId: id },
    order: [{ field: "createdAt", ascending: false }],
    limit: 100,
  });
  return json({ versions });
});

export const POST = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  if (!(await ctx.db.table("scenes").get(id))) throw notFound("Scene");
  const body = await parseJson(req, promptVersionCreateSchema);
  const last = await ctx.db.table("prompt_versions").first({ where: { sceneId: id }, order: [{ field: "createdAt", ascending: false }] });
  if (last && last.text === body.text) return json({ version: last, unchanged: true });
  return json({ version: await ctx.db.table("prompt_versions").insert({ ...body, sceneId: id, generationId: null }) }, { status: 201 });
});
