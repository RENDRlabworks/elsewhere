import { z } from "zod";
import { sceneContentSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { refinePrompt } from "@/lib/services/assist";

export const maxDuration = 120;

/** Proposes a refined prompt for review. It is never applied without the user's approval. */
export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  const body = await parseJson(req, z.object({ scene: sceneContentSchema, direction: z.string().max(2000).default("") }));
  return json(await refinePrompt(ctx, body.scene, body.direction));
});
