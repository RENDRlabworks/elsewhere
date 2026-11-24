import { conceptRequestSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { generateConceptBatch } from "@/lib/services/assist";

export const maxDuration = 120;

/** Structured concept generation. Returns validated data only; never generates images. */
export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  const body = await parseJson(req, conceptRequestSchema);
  return json(await generateConceptBatch(ctx, body));
});
