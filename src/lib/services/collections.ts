import "server-only";
import { zipSync } from "fflate";
import type { Collection, CollectionItem, Generation, Scene } from "@/lib/domain/schemas";
import { computeInsights } from "@/lib/composition/analytics";
import type { ServerContext } from "@/lib/server/context";
import { badRequest, notFound } from "@/lib/server/http";
import type { Bucket } from "@/lib/storage";
import { fileFromForm, saveImageAsset } from "./assets";
import { buildSearchText, setTags } from "./tags";

export type CollectionSummary = Collection & {
  itemCount: number;
  imageCount: number;
  coverAssetId: string | null;
  previewAssetIds: string[];
};

export type CollectionItemView = CollectionItem & { generation: Generation | null; scene: Scene | null };

export async function getCollection(ctx: ServerContext, id: string) {
  const c = await ctx.db.table("collections").get(id);
  if (!c) throw notFound("Collection");
  return c;
}

export async function listCollections(ctx: ServerContext): Promise<CollectionSummary[]> {
  const collections = await ctx.db.table("collections").list({ order: [{ field: "updatedAt", ascending: false }] });
  if (!collections.length) return [];
  const items = await ctx.db.table("collection_items").list({
    where: { collectionId: { in: collections.map((c) => c.id) } },
    order: [{ field: "position" }],
  });
  const genIds = [...new Set(items.map((i) => i.generationId).filter((x): x is string => !!x))];
  const gens = genIds.length
    ? await ctx.db.table("generations").list({ where: { id: { in: genIds } }, select: ["id", "assetId", "status"] })
    : [];
  const assetOf = new Map(gens.map((g) => [g.id, g.assetId]));
  return collections.map((c) => {
    const mine = items.filter((i) => i.collectionId === c.id);
    const assets = mine.map((i) => (i.generationId ? assetOf.get(i.generationId) : null)).filter((a): a is string => !!a);
    const cover = c.coverGenerationId ? (assetOf.get(c.coverGenerationId) ?? null) : (assets[0] ?? null);
    return { ...c, itemCount: mine.length, imageCount: assets.length, coverAssetId: cover, previewAssetIds: assets.slice(0, 4) };
  });
}

export async function getCollectionDetail(ctx: ServerContext, id: string) {
  const collection = await getCollection(ctx, id);
  const items = await ctx.db.table("collection_items").list({ where: { collectionId: id }, order: [{ field: "position" }] });
  const genIds = items.map((i) => i.generationId).filter((x): x is string => !!x);
  const sceneIds = items.map((i) => i.sceneId).filter((x): x is string => !!x);
  const [gens, scenes] = await Promise.all([
    genIds.length ? ctx.db.table("generations").list({ where: { id: { in: genIds } } }) : [],
    sceneIds.length ? ctx.db.table("scenes").list({ where: { id: { in: sceneIds } } }) : [],
  ]);
  const view: CollectionItemView[] = items.map((i) => ({
    ...i,
    generation: gens.find((g) => g.id === i.generationId) ?? null,
    scene: scenes.find((s) => s.id === i.sceneId) ?? null,
  }));
  return { collection, items: view };
}

export async function createCollection(ctx: ServerContext, input: Pick<Collection, "name" | "description" | "styleProfileId" | "tags" | "targetCount">) {
  const c = await ctx.db.table("collections").insert({
    ...input,
    notes: "",
    coverGenerationId: null,
    viewMode: "masonry",
    isSeed: false,
  });
  if (input.tags.length) await setTags(ctx, "collection", c.id, input.tags);
  return c;
}

export async function updateCollection(ctx: ServerContext, id: string, patch: Partial<Collection>) {
  await getCollection(ctx, id);
  if (patch.tags) patch.tags = await setTags(ctx, "collection", id, patch.tags);
  return ctx.db.table("collections").update(id, patch);
}

export async function deleteCollection(ctx: ServerContext, id: string) {
  await getCollection(ctx, id);
  await ctx.db.table("collection_items").deleteWhere({ collectionId: id });
  await ctx.db.table("taggings").deleteWhere({ targetType: "collection", targetId: id });
  await ctx.db.table("collections").delete(id);
}

export async function duplicateCollection(ctx: ServerContext, id: string) {
  const { collection, items } = await getCollectionDetail(ctx, id);
  const copy = await ctx.db.table("collections").insert({
    name: `${collection.name} copy`,
    description: collection.description,
    notes: collection.notes,
    coverGenerationId: collection.coverGenerationId,
    styleProfileId: collection.styleProfileId,
    tags: collection.tags,
    targetCount: collection.targetCount,
    viewMode: collection.viewMode,
    isSeed: false,
  });
  await ctx.db.table("collection_items").insertMany(
    items.map((i) => ({ collectionId: copy.id, generationId: i.generationId, sceneId: i.sceneId, position: i.position })),
  );
  return copy;
}

async function touch(ctx: ServerContext, id: string) {
  await ctx.db.table("collections").update(id, {});
}

export async function addItems(ctx: ServerContext, id: string, generationIds: string[]) {
  await getCollection(ctx, id);
  const items = ctx.db.table("collection_items");
  const existing = await items.list({ where: { collectionId: id } });
  const have = new Set(existing.map((i) => i.generationId));
  const valid = await ctx.db.table("generations").list({ where: { id: { in: generationIds } }, select: ["id"] });
  const validIds = new Set(valid.map((v) => v.id));
  const toAdd = generationIds.filter((g) => validIds.has(g) && !have.has(g));
  const start = existing.reduce((m, i) => Math.max(m, i.position), -1) + 1;
  const added = await items.insertMany(toAdd.map((generationId, i) => ({ collectionId: id, generationId, sceneId: null, position: start + i })));
  await touch(ctx, id);
  return { added: added.length, skipped: generationIds.length - added.length };
}

export async function removeItems(ctx: ServerContext, id: string, itemIds: string[]) {
  const n = await ctx.db.table("collection_items").deleteWhere({ collectionId: id, id: { in: itemIds } });
  await touch(ctx, id);
  return n;
}

export async function reorderItems(ctx: ServerContext, id: string, itemIds: string[]) {
  const items = await ctx.db.table("collection_items").list({ where: { collectionId: id } });
  const known = new Set(items.map((i) => i.id));
  if (itemIds.some((i) => !known.has(i))) throw badRequest("Unknown item in ordering");
  const order = [...itemIds, ...items.filter((i) => !itemIds.includes(i.id)).sort((a, b) => a.position - b.position).map((i) => i.id)];
  await Promise.all(
    order.map((itemId, position) => {
      const cur = items.find((i) => i.id === itemId)!;
      return cur.position === position ? null : ctx.db.table("collection_items").update(itemId, { position });
    }),
  );
  await touch(ctx, id);
}

export async function moveItems(ctx: ServerContext, id: string, itemIds: string[], targetId: string) {
  await getCollection(ctx, targetId);
  const items = await ctx.db.table("collection_items").list({ where: { collectionId: id, id: { in: itemIds } } });
  const genIds = items.map((i) => i.generationId).filter((g): g is string => !!g);
  const res = genIds.length ? await addItems(ctx, targetId, genIds) : { added: 0, skipped: 0 };
  await removeItems(ctx, id, items.filter((i) => !i.sceneId).map((i) => i.id));
  return res;
}

/** Attach original artwork to a seeded scene slot. Never generates a substitute. */
export async function importOriginal(ctx: ServerContext, collectionId: string, itemId: string, form: FormData) {
  const item = await ctx.db.table("collection_items").get(itemId);
  if (!item || item.collectionId !== collectionId) throw notFound("Collection item");
  const scene = item.sceneId ? await ctx.db.table("scenes").get(item.sceneId) : null;
  const file = await fileFromForm(form);
  const asset = await saveImageAsset(ctx, "import", file.data, file.mimeType);
  const { id: _id, userId: _u, createdAt: _c, updatedAt: _up, status: _s, origin: _o, seriesIndex: _si, archived: _a, ...content } = scene ?? ({} as Scene);
  void _id; void _u; void _c; void _up; void _s; void _o; void _si; void _a;
  const base = {
    sceneId: scene?.id ?? null,
    jobId: null,
    parentId: null,
    rootId: null,
    kind: "import" as const,
    source: "imported" as const,
    status: "completed" as const,
    title: scene?.title ?? file.name.replace(/\.[^.]+$/, ""),
    prompt: "",
    promptSections: [],
    sceneSnapshot: scene ? content : null,
    styleProfileId: scene?.styleProfileId ?? null,
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
    reviewStatus: "accepted" as const,
    notes: "Original artwork, imported.",
    tags: ["original"],
    characterKind: scene?.subject.kind ?? null,
    environment: scene?.environment ?? "",
    paletteHexes: asset.dominantColors,
    variationIndex: 0,
    isDevPlaceholder: false,
    completedAt: new Date().toISOString(),
  };
  const previous = item.generationId;
  const gen = await ctx.db.table("generations").insert({ ...base, searchText: buildSearchText(base) });
  await ctx.db.table("collection_items").update(item.id, { generationId: gen.id });
  await touch(ctx, collectionId);
  return { generation: gen, replaced: previous };
}

export async function collectionInsights(ctx: ServerContext, id: string) {
  const { items } = await getCollectionDetail(ctx, id);
  return computeInsights(items.map((i) => i.generation).filter((g): g is Generation => !!g && g.status === "completed"));
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "image";
}

/** Zip the original files for a set of images. */
export async function zipGenerations(ctx: ServerContext, generations: Generation[]) {
  const files: Record<string, Uint8Array> = {};
  let i = 0;
  for (const g of generations) {
    if (!g.assetId) continue;
    const asset = await ctx.db.table("assets").get(g.assetId);
    if (!asset) continue;
    const data = await ctx.storage.get(asset.bucket as Bucket, asset.path);
    if (!data) continue;
    i++;
    const ext = asset.path.split(".").pop();
    files[`${String(i).padStart(2, "0")}-${slug(g.title)}.${ext}`] = new Uint8Array(data);
  }
  files["manifest.json"] = new TextEncoder().encode(
    JSON.stringify(
      generations.map((g) => ({ id: g.id, title: g.title, prompt: g.prompt, model: g.model, provider: g.provider, createdAt: g.createdAt })),
      null,
      2,
    ),
  );
  return zipSync(files, { level: 0 });
}
