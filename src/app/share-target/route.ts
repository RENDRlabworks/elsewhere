import { NextResponse } from "next/server";
import { getContext } from "@/lib/server/context";
import { MAX_UPLOAD_BYTES } from "@/lib/services/assets";
import { createIdea } from "@/lib/services/ideas";

export const maxDuration = 30;

/**
 * Web Share Target: Elsewhere appears in the phone's share sheet once it is added to
 * the home screen. Whatever is shared (a photo, a link, some text) lands in the inbox.
 */
export async function POST(req: Request) {
  const back = (q: string) => NextResponse.redirect(new URL(`/inbox?${q}`, req.url), 303);
  try {
    const form = await req.formData();
    const title = String(form.get("title") ?? "").trim();
    const text = String(form.get("text") ?? "").trim();
    const url = String(form.get("url") ?? "").trim() || null;
    const files = form.getAll("photos").filter((f): f is File => typeof f !== "string" && f.size > 0 && f.type.startsWith("image/"));
    const ctx = await getContext();
    const words = [title, text].filter((s, i, a) => s && a.indexOf(s) === i).join("\n");
    let added = 0;
    if (files.length) {
      for (const f of files.slice(0, 6)) {
        if (f.size > MAX_UPLOAD_BYTES) continue;
        await createIdea(ctx, { text: added ? "" : words, url: added ? null : url, source: "shared", file: { data: Buffer.from(await f.arrayBuffer()), mimeType: f.type } });
        added++;
      }
    } else if (words || url) {
      await createIdea(ctx, { text: words, url, source: "shared" });
      added = 1;
    }
    return back(added ? `shared=${added}` : "shared=0");
  } catch (err) {
    console.error("[elsewhere] share target failed", err);
    return back("shared=error");
  }
}

export function GET(req: Request) {
  return NextResponse.redirect(new URL("/inbox", req.url), 303);
}
