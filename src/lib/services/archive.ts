import "server-only";
import type { Generation, GenerationListQuery } from "@/lib/domain/schemas";
import type { Where } from "@/lib/data/types";
import type { ServerContext } from "@/lib/server/context";
import { sweepStaleJobs } from "./generations";

export async function listGenerations(ctx: ServerContext, q: GenerationListQuery) {
  await sweepStaleJobs(ctx);
  const where: Where<Generation> = {};
  if (q.filter === "favorites") where.favorite = true;
  else if (q.filter !== "all") where.reviewStatus = q.filter;
  if (q.status === "completed") where.status = "completed";
  else if (q.status === "active") where.status = { in: ["queued", "generating", "processing"] };
  else if (q.status === "failed") where.status = { in: ["failed", "cancelled"] };
  if (q.sceneId) where.sceneId = q.sceneId;
  if (q.styleProfileId) where.styleProfileId = q.styleProfileId;
  if (q.character) where.characterKind = q.character;
  if (q.environment) where.environment = q.environment;
  if (q.model) where.model = q.model;
  if (q.paletteHex) where.paletteHexes = { contains: q.paletteHex.toLowerCase() };
  if (q.from) where.createdAt = { gte: q.from };
  if (q.to) (where as Record<string, unknown>).completedAt = { lte: q.to };
  if (q.collectionId) {
    const items = await ctx.db.table("collection_items").list({ where: { collectionId: q.collectionId }, select: ["generationId"] });
    const ids = items.map((i) => i.generationId).filter((x): x is string => !!x);
    if (!ids.length) return { items: [], total: 0 };
    where.id = { in: ids };
  }
  const search = q.q?.trim() ? { field: "searchText" as const, query: q.q.toLowerCase() } : undefined;
  const table = ctx.db.table("generations");
  const [items, total] = await Promise.all([
    table.list({ where, search, order: [{ field: "createdAt", ascending: false }, { field: "variationIndex" }], limit: q.limit, offset: q.offset }),
    table.count({ where, search }),
  ]);
  return { items: items.map(stripHeavy), total };
}

/** List rows omit the large search index column. */
function stripHeavy(g: Generation): Generation {
  return { ...g, searchText: "" };
}

/** Distinct facet values for archive filters. */
export async function archiveFacets(ctx: ServerContext) {
  const rows = await ctx.db.table("generations").list({ select: ["characterKind", "environment", "model", "styleProfileId", "paletteHexes"], limit: 2000, order: [{ field: "createdAt", ascending: false }] });
  const count = (vals: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, count: n }));
  };
  return {
    characters: count(rows.map((r) => r.characterKind)),
    environments: count(rows.map((r) => r.environment)).slice(0, 40),
    models: count(rows.map((r) => r.model)),
    styles: count(rows.map((r) => r.styleProfileId)),
    palette: count(rows.flatMap((r) => r.paletteHexes ?? [])).slice(0, 24),
  };
}

export async function usageSummary(ctx: ServerContext) {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const rows = await ctx.db.table("usage_records").list({ where: { createdAt: { gte: month } } });
  const sum = (rs: typeof rows) => ({
    // Development sketches are free and do not count toward limits.
    images: rs.filter((r) => r.kind === "image" && r.provider !== "dev").reduce((a, r) => a + r.images, 0),
    sketches: rs.filter((r) => r.kind === "image" && r.provider === "dev").reduce((a, r) => a + r.images, 0),
    costUsd: rs.reduce((a, r) => a + (r.costUsd ?? 0), 0),
    estimated: rs.some((r) => r.estimated),
    unknownCost: rs.filter((r) => r.costUsd == null && r.provider !== "dev").length,
  });
  return { today: sum(rows.filter((r) => r.createdAt >= day)), month: sum(rows), records: rows.slice(-50).reverse() };
}

export async function storageSummary(ctx: ServerContext) {
  const assets = await ctx.db.table("assets").list({ select: ["kind", "bytes"] });
  const by = (k: string) => assets.filter((a) => a.kind === k);
  const total = (as: typeof assets) => as.reduce((a, x) => a + x.bytes, 0);
  return {
    files: assets.length,
    bytes: total(assets),
    generations: { files: by("generation").length, bytes: total(by("generation")) },
    references: { files: by("reference").length, bytes: total(by("reference")) },
    imports: { files: by("import").length, bytes: total(by("import")) },
  };
}

/** Full JSON export of the user's records (image files are referenced by asset id). */
export async function exportAll(ctx: ServerContext) {
  const tables = [
    "profiles",
    "user_preferences",
    "style_profiles",
    "style_profile_versions",
    "reference_images",
    "assets",
    "scenes",
    "palettes",
    "prompt_templates",
    "prompt_versions",
    "generations",
    "generation_jobs",
    "collections",
    "collection_items",
    "tags",
    "taggings",
    "image_reviews",
    "usage_records",
  ] as const;
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), app: "elsewhere", version: 1 };
  for (const t of tables) out[t] = await ctx.db.table(t).list();
  return out;
}
