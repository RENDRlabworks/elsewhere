import { sceneUpdateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, notFound, parseJson } from "@/lib/server/http";

type P = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const scene = await ctx.db.table("scenes").get(id);
  if (!scene) throw notFound("Scene");
  return json({ scene });
});

export const PATCH = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const current = await ctx.db.table("scenes").get(id);
  if (!current) throw notFound("Scene");
  const patch = await parseJson(req, sceneUpdateSchema);
  // Editing a seeded Volume I record turns it into a working draft copy, preserving the original.
  if (current.status === "seed") {
    const { id: _i, userId: _u, createdAt: _c, updatedAt: _up, ...rest } = current;
    void _i; void _u; void _c; void _up;
    const copy = await ctx.db.table("scenes").insert({ ...rest, ...patch, status: "draft", origin: "restore", seriesIndex: null });
    return json({ scene: copy, forked: true });
  }
  return json({ scene: await ctx.db.table("scenes").update(id, patch) });
});

export const DELETE = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const scene = await ctx.db.table("scenes").get(id);
  if (!scene) throw notFound("Scene");
  // Scenes are archived, not destroyed: generations keep their own immutable snapshots.
  await ctx.db.table("scenes").update(id, { archived: true });
  return json({ ok: true });
});
