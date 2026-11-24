import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";
import { computeInsights } from "@/lib/composition/analytics";

/** Composition diversity across the whole archive (or one scene's generations). */
export const GET = handle(async (req: Request) => {
  const ctx = await getContext();
  const sceneId = new URL(req.url).searchParams.get("sceneId");
  const gens = await ctx.db.table("generations").list({
    where: { status: "completed", ...(sceneId ? { sceneId } : {}) },
    select: ["sceneSnapshot", "reviewStatus", "status"],
    order: [{ field: "createdAt", ascending: false }],
    limit: 500,
  });
  return json({ insights: computeInsights(gens) });
});
