import { sceneContentSchema, sceneCreateSchema, type SceneStatus } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";

export const GET = handle(async (req: Request) => {
  const ctx = await getContext();
  const status = new URL(req.url).searchParams.get("status") as SceneStatus | null;
  const scenes = await ctx.db.table("scenes").list({
    where: { archived: false, ...(status ? { status } : {}) },
    order: [{ field: "updatedAt", ascending: false }],
    limit: 200,
  });
  return json({ scenes });
});

export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  const body = await parseJson(req, sceneCreateSchema);
  const { status, origin, ...content } = body;
  const scene = await ctx.db.table("scenes").insert({
    ...sceneContentSchema.parse(content),
    status,
    origin,
    seriesIndex: null,
    archived: false,
  });
  return json({ scene }, { status: 201 });
});
