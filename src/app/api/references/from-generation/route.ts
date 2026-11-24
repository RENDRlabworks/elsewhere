import { z } from "zod";
import { REFERENCE_ROLES } from "@/lib/domain/vocab";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { referenceFromGeneration } from "@/lib/services/references";

const body = z.object({
  generationIds: z.array(z.string().min(1)).min(1).max(20),
  profileId: z.string().min(1),
  role: z.enum(REFERENCE_ROLES).default("style"),
});

/** Attach one or more existing images to a Style DNA reference board without re-uploading. */
export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  const { generationIds, profileId, role } = await parseJson(req, body);
  const references = [];
  for (const generationId of generationIds) references.push(await referenceFromGeneration(ctx, { generationId, profileId, role }));
  return json({ references }, { status: 201 });
});
