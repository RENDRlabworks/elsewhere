import { ideaUpdateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { deleteIdea, updateIdea } from "@/lib/services/ideas";

type P = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  return json({ idea: await updateIdea(ctx, id, await parseJson(req, ideaUpdateSchema)) });
});

export const DELETE = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  await deleteIdea(await getContext(), id);
  return json({ ok: true });
});
