import { z } from "zod";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { duplicateStyleProfile } from "@/lib/services/styles";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getContext();
  const body = await parseJson(req, z.object({ name: z.string().trim().min(1).max(80).optional() }));
  return json({ profile: await duplicateStyleProfile(ctx, id, body.name) }, { status: 201 });
});
