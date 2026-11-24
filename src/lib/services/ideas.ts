import "server-only";
import { type Idea, type IDEA_SOURCES, type IDEA_STATUSES, outputSchema, sceneContentSchema } from "@/lib/domain/schemas";
import type { ServerContext } from "@/lib/server/context";
import { badRequest, HttpError, notFound } from "@/lib/server/http";
import { saveImageAsset } from "./assets";
import { getPreferences } from "./generations";
import { deleteAssetIfUnused } from "./references";

/**
 * The ideas inbox: notes, links and photos captured on the go. An idea becomes a
 * scene in Create when the user is ready to work on it; until then it waits here.
 */

const MISSING = /ideas/i;
const NOT_THERE = /does not exist|schema cache|could not find|undefined table|42P01/i;

/** A Supabase project that has not run the inbox migration yet gets a clear message, not a 500. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (MISSING.test(msg) && NOT_THERE.test(msg)) {
      throw new HttpError(503, "The ideas inbox needs its database migration. Run 20261127000000_ideas_inbox.sql in Supabase, then try again.", "migration_required");
    }
    throw err;
  }
}

export async function listIdeas(ctx: ServerContext, status: (typeof IDEA_STATUSES)[number] = "inbox") {
  return guard(() =>
    ctx.db.table("ideas").list({ where: { status }, order: [{ field: "createdAt", ascending: false }], limit: 300 }),
  );
}

export async function countInbox(ctx: ServerContext) {
  return guard(() => ctx.db.table("ideas").count({ where: { status: "inbox" } }));
}

/** Pull a URL out of shared text so links stay clickable. */
export function splitSharedText(text: string, url: string | null) {
  if (url) return { text: text.trim(), url };
  const m = /\bhttps?:\/\/[^\s<>"]+/i.exec(text);
  if (!m) return { text: text.trim(), url: null };
  const rest = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s{2,}/g, " ").trim();
  return { text: rest, url: m[0].replace(/[).,;]+$/, "") };
}

export async function createIdea(
  ctx: ServerContext,
  input: { text: string; url: string | null; source: (typeof IDEA_SOURCES)[number]; file?: { data: Buffer; mimeType: string } | null },
) {
  const { text, url } = splitSharedText(input.text, input.url);
  if (!text && !url && !input.file) throw badRequest("Write something, add a link or attach a photo.");
  return guard(async () => {
    // Check the table exists before storing a photo, so a missing migration leaves no orphan file.
    await ctx.db.table("ideas").count({ where: { status: "inbox" } });
    const asset = input.file ? await saveImageAsset(ctx, "import", input.file.data, input.file.mimeType) : null;
    return ctx.db.table("ideas").insert({
      text: text.slice(0, 4000),
      url: url ? url.slice(0, 2000) : null,
      assetId: asset?.id ?? null,
      source: input.file && input.source === "typed" ? "photo" : input.source,
      status: "inbox",
      sceneId: null,
    } as Omit<Idea, "id" | "userId" | "createdAt" | "updatedAt">);
  });
}

async function getIdea(ctx: ServerContext, id: string) {
  const idea = await guard(() => ctx.db.table("ideas").get(id));
  if (!idea) throw notFound("Idea");
  return idea;
}

export async function updateIdea(ctx: ServerContext, id: string, patch: { text?: string; status?: Idea["status"] }) {
  await getIdea(ctx, id);
  return ctx.db.table("ideas").update(id, patch);
}

export async function deleteIdea(ctx: ServerContext, id: string) {
  const idea = await getIdea(ctx, id);
  await ctx.db.table("ideas").delete(id);
  await deleteAssetIfUnused(ctx, idea.assetId);
}

/** Title from the first line, trimmed at a word boundary. */
export function ideaTitle(idea: Pick<Idea, "text" | "url" | "createdAt">) {
  const first = idea.text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  if (first) return first.length > 72 ? `${first.slice(0, 72).replace(/\s+\S*$/, "")}...` : first.replace(/[.]+$/, "");
  if (idea.url) {
    try {
      return `Idea from ${new URL(idea.url).hostname.replace(/^www\./, "")}`;
    } catch {
      // fall through
    }
  }
  return "Idea from your inbox";
}

/**
 * Turn an idea into a new scene: its words become the description, and a photo
 * comes along as an environment reference so the place carries into Create.
 */
export async function useIdea(ctx: ServerContext, id: string) {
  const idea = await getIdea(ctx, id);
  if (idea.sceneId) {
    const existing = await ctx.db.table("scenes").get(idea.sceneId);
    if (existing && !existing.archived) return { idea, scene: existing };
  }
  const prefs = await getPreferences(ctx);
  const d = prefs.defaults;
  let referenceIds: string[] = [];
  if (idea.assetId) {
    const ref = await ctx.db.table("reference_images").insert({
      profileId: null,
      assetId: idea.assetId,
      role: "environment",
      label: "Inbox photo",
      notes: idea.text.slice(0, 500),
      enabled: true,
    });
    referenceIds = [ref.id];
  }
  const description = [idea.text.trim(), idea.url ? `Link: ${idea.url}` : ""].filter(Boolean).join("\n\n");
  const scene = await ctx.db.table("scenes").insert({
    ...sceneContentSchema.parse({
      title: ideaTitle(idea),
      description: description.slice(0, 4000),
      styleProfileId: prefs.activeStyleProfileId ?? d.styleProfileId ?? null,
      referenceIds,
      output: outputSchema.parse({ provider: d.provider, model: d.model, aspectRatio: d.aspectRatio, longEdge: d.longEdge, quality: d.quality, format: d.format }),
    }),
    status: "draft",
    origin: "studio",
    seriesIndex: null,
    archived: false,
  });
  const updated = await ctx.db.table("ideas").update(idea.id, { status: "used", sceneId: scene.id });
  return { idea: updated, scene };
}
