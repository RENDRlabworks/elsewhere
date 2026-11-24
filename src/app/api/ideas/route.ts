import { ideaRequestSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { generateFieldIdeas } from "@/lib/services/assist";

export const maxDuration = 60;

/** Ideas for one free-text scene field. Text only; never generates images. */
export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  const body = await parseJson(req, ideaRequestSchema);
  return json(await generateFieldIdeas(ctx, body));
});
