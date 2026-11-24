import { generationListQuerySchema, generationRequestSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson, parseQuery } from "@/lib/server/http";
import { listGenerations } from "@/lib/services/archive";
import { startGeneration } from "@/lib/services/generations";

// Generation runs after the response via `after()`; allow time for high-quality renders.
export const maxDuration = 300;

export const GET = handle(async (req: Request) => {
  const ctx = await getContext();
  return json(await listGenerations(ctx, parseQuery(req, generationListQuerySchema)));
});

export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  const body = await parseJson(req, generationRequestSchema);
  const { job, generations, notes, plan } = await startGeneration(ctx, body);
  return json(
    {
      job,
      generations,
      notes,
      estimate: plan ? { usd: plan.estimateUsd, basis: plan.estimateBasis } : null,
    },
    { status: 202 },
  );
});
