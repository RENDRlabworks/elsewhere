import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";
import { importImage } from "@/lib/services/imports";

export const maxDuration = 30;

/** Bring in an image from outside (multipart: file, optional sceneId and title). */
export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  return json({ generation: await importImage(ctx, await req.formData()) }, { status: 201 });
});
