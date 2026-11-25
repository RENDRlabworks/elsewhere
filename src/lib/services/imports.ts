import "server-only";
import type { Asset, Generation, SceneContent } from "@/lib/domain/schemas";
import type { ServerContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/http";
import { fileFromForm, saveImageAsset } from "./assets";
import { buildSearchText } from "./tags";

/**
 * Record an image that came from outside Elsewhere as a finished image, so it can sit
 * in a scene's filmstrip and be the source for variations. Nothing is generated.
 */
export async function createImportedGeneration(
  ctx: ServerContext,
  asset: Asset,
  opts: {
    title: string;
    sceneId?: string | null;
    sceneSnapshot?: SceneContent | null;
    styleProfileId?: string | null;
    tags?: string[];
    notes?: string;
  },
): Promise<Generation> {
  const scene = opts.sceneSnapshot ?? null;
  const base = {
    sceneId: opts.sceneId ?? null,
    jobId: null,
    parentId: null,
    rootId: null,
    kind: "import" as const,
    source: "imported" as const,
    status: "completed" as const,
    title: opts.title,
    prompt: "",
    promptSections: [],
    sceneSnapshot: scene,
    styleProfileId: opts.styleProfileId ?? null,
    styleVersionId: null,
    styleSnapshot: null,
    referenceIds: [],
    referencesSubmitted: false,
    provider: null,
    model: null,
    outputSettings: null,
    width: asset.width,
    height: asset.height,
    assetId: asset.id,
    errorMessage: null,
    durationMs: null,
    costUsd: null,
    costEstimated: false,
    usage: null,
    rating: 0,
    favorite: false,
    // Brought in, not made here, so it never waits in Review.
    reviewStatus: "accepted" as const,
    notes: opts.notes ?? "",
    tags: opts.tags ?? [],
    characterKind: scene?.subject.kind ?? null,
    environment: scene?.environment ?? "",
    paletteHexes: asset.dominantColors,
    variationIndex: 0,
    isDevPlaceholder: false,
    completedAt: new Date().toISOString(),
  };
  return ctx.db.table("generations").insert({ ...base, searchText: buildSearchText(base) });
}

/** A pasted, dropped or uploaded image, ready to vary. Optionally filed under a scene. */
export async function importImage(ctx: ServerContext, form: FormData) {
  const file = await fileFromForm(form);
  const sceneId = typeof form.get("sceneId") === "string" && form.get("sceneId") ? String(form.get("sceneId")) : null;
  if (sceneId && !(await ctx.db.table("scenes").get(sceneId))) throw notFound("Scene");
  const asset = await saveImageAsset(ctx, "import", file.data, file.mimeType);
  const named = file.name && !/^(image|pasted-photo)\.\w+$/i.test(file.name) ? file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() : "";
  return createImportedGeneration(ctx, asset, {
    title: String(form.get("title") ?? "").trim().slice(0, 160) || named || "Pasted image",
    sceneId,
    tags: ["imported"],
    notes: "Brought in from outside Elsewhere.",
  });
}
