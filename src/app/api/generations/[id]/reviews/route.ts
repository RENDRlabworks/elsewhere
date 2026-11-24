import { manualReviewSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, notFound, parseJson } from "@/lib/server/http";

type P = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  return json({ reviews: await ctx.db.table("image_reviews").list({ where: { generationId: id }, order: [{ field: "createdAt", ascending: false }] }) });
});

export const POST = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const gen = await ctx.db.table("generations").get(id);
  if (!gen) throw notFound("Image");
  const body = await parseJson(req, manualReviewSchema);
  const review = await ctx.db.table("image_reviews").insert({
    generationId: id,
    kind: "manual",
    criteria: body.criteria,
    summary: body.summary,
    findings: [],
    driftDetected: false,
    suggestions: [],
    repetitionNotes: "",
    model: null,
    styleVersionId: gen.styleVersionId,
  });
  return json({ review }, { status: 201 });
});
