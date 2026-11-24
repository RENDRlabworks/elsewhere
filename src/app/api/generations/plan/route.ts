import { generationRequestSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { planGeneration } from "@/lib/services/generations";

/** Preview what a generation would submit: provider, model, size, references, notes and cost estimate. */
export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  const body = await parseJson(req, generationRequestSchema);
  const plan = await planGeneration(ctx, body);
  return json({
    provider: plan.provider,
    model: { id: plan.model.id, label: plan.model.label, unverified: !!plan.model.unverified },
    width: plan.width,
    height: plan.height,
    quality: plan.quality,
    format: plan.format,
    background: plan.background,
    n: plan.n,
    referencesSubmitted: plan.referencesSubmitted,
    referenceCount: plan.referenceIds.length,
    estimate: { usd: plan.estimateUsd, basis: plan.estimateBasis },
    notes: plan.notes,
    prompt: plan.prompt,
  });
});
