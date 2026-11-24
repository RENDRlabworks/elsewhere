import { IDEA_STATUSES, ideaCreateSchema } from "@/lib/domain/schemas";
import { MAX_UPLOAD_BYTES } from "@/lib/services/assets";
import { getContext } from "@/lib/server/context";
import { badRequest, handle, json, parseJson } from "@/lib/server/http";
import { countInbox, createIdea, listIdeas } from "@/lib/services/ideas";

export const maxDuration = 30;

/** Ideas in the inbox (or ?status=used|archived), newest first, with the inbox count. */
export const GET = handle(async (req: Request) => {
  const ctx = await getContext();
  const raw = new URL(req.url).searchParams.get("status") ?? "inbox";
  const status = (IDEA_STATUSES as readonly string[]).includes(raw) ? (raw as (typeof IDEA_STATUSES)[number]) : "inbox";
  const [ideas, count] = await Promise.all([listIdeas(ctx, status), countInbox(ctx)]);
  return json({ ideas, count });
});

/** Capture an idea. JSON { text, url } or a form with text, url and an optional photo. */
export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await req.formData();
    const f = form.get("file");
    let file: { data: Buffer; mimeType: string } | null = null;
    if (f && typeof f !== "string" && f.size) {
      if (f.size > MAX_UPLOAD_BYTES) throw badRequest("Photos must be 25 MB or smaller");
      file = { data: Buffer.from(await f.arrayBuffer()), mimeType: f.type || "application/octet-stream" };
    }
    const parsed = ideaCreateSchema.safeParse({ text: String(form.get("text") ?? ""), url: form.get("url") ? String(form.get("url")) : null });
    if (!parsed.success) throw badRequest("That link does not look like a web address");
    const idea = await createIdea(ctx, { ...parsed.data, source: file ? "photo" : "typed", file });
    return json({ idea }, { status: 201 });
  }
  const body = await parseJson(req, ideaCreateSchema);
  return json({ idea: await createIdea(ctx, { ...body, source: "typed" }) }, { status: 201 });
});
