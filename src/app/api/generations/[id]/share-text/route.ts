import { z } from "zod";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { getShareText, updateShareText, writeShareText } from "@/lib/services/share";

export const maxDuration = 60;

type P = { params: Promise<{ id: string }> };

/** Saved caption and alt text, or a draft written from the scene. */
export const GET = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  return json(await getShareText(await getContext(), id));
});

/** Write a fresh caption and alt text, with AI assistance when it is configured. */
export const POST = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  return json(await writeShareText(await getContext(), id));
});

/** Keep the user's own edits. */
export const PUT = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const body = await parseJson(req, z.object({ caption: z.string().max(2200), altText: z.string().max(2000) }));
  return json(await updateShareText(await getContext(), id, body));
});
