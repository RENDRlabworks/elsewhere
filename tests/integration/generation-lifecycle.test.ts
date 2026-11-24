/**
 * End-to-end service tests in local development mode: bootstrap, generation
 * lifecycle, idempotency, cancellation, spending safeguards, storage and the
 * repository's column mapping against the Supabase migration.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";

process.env.ELSEWHERE_DATA_MODE = "local";
delete process.env.OPENAI_API_KEY;

const { createLocalDatabase } = await import("@/lib/data/local");
const { createLocalStorage } = await import("@/lib/storage");
const { toSnake } = await import("@/lib/data/supabase");
const { ensureBootstrap } = await import("@/lib/services/bootstrap");
const { startGeneration, cancelJob, deleteGenerationPermanently, updateGenerationMeta } = await import("@/lib/services/generations");
const { saveImageAsset } = await import("@/lib/services/assets");
const { referenceFromGeneration, deleteAssetIfUnused } = await import("@/lib/services/references");
const { IMAGE_PROVIDERS } = await import("@/lib/providers/image/registry");
const { sceneContentSchema } = await import("@/lib/domain/schemas");
const { HttpError } = await import("@/lib/server/http");
type Ctx = import("@/lib/server/context").ServerContext;

const dir = mkdtempSync(path.join(os.tmpdir(), "elsewhere-test-"));
const USER = "00000000-0000-4000-8000-0000000000aa";
const OTHER = "00000000-0000-4000-8000-0000000000bb";
const LEGACY = "00000000-0000-4000-8000-0000000000cc";
const ctxFor = (userId: string): Ctx => ({
  mode: "local",
  userId,
  email: null,
  db: createLocalDatabase(userId, dir),
  storage: createLocalStorage(dir),
});
const ctx = ctxFor(USER);

async function waitForJob(jobId: string, timeout = 15000) {
  const start = Date.now();
  for (;;) {
    const job = await ctx.db.table("generation_jobs").get(jobId);
    if (job && ["completed", "failed", "cancelled"].includes(job.status)) return job;
    if (Date.now() - start > timeout) throw new Error(`Job ${jobId} did not finish`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const scene = (over: Record<string, unknown> = {}) =>
  sceneContentSchema.parse({
    title: "The Last Wish",
    environment: "a dark meadow",
    phenomenon: "a dandelion clock as tall as a tree",
    subject: { kind: "fox" },
    palette: { swatches: [{ id: "a", hex: "#16251c" }, { id: "b", hex: "#9aa38a" }] },
    ...over,
  });

let key = 0;
const idem = () => `test-key-${Date.now()}-${key++}`;

beforeAll(async () => {
  await ensureBootstrap(ctx);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("bootstrap", () => {
  it("seeds the seven Style DNA presets and Volume I exactly once", async () => {
    await ensureBootstrap(ctx);
    const profiles = await ctx.db.table("style_profiles").list();
    expect(profiles.map((p) => p.name).sort()).toEqual(
      [
        "Atmospheric Monochrome",
        "Cosmic Minimalism",
        "Elsewhere Original",
        "Elsewhere Volume I",
        "Nocturnal Nature",
        "Quiet Architectural",
        "Surreal Geological",
      ].sort(),
    );
    expect(profiles.every((p) => p.currentVersion === 1)).toBe(true);
    const seed = await ctx.db.table("collections").list({ where: { isSeed: true } });
    expect(seed).toHaveLength(1);
    expect(seed[0].name).toBe("Elsewhere: Volume I");
    const items = await ctx.db.table("collection_items").list({ where: { collectionId: seed[0].id } });
    expect(items).toHaveLength(20);
    expect(items.every((i) => i.generationId === null && i.sceneId)).toBe(true);

    const house = profiles.find((p) => p.presetKey === "elsewhere-volume-i")!;
    expect(seed[0].styleProfileId).toBe(house.id);
    const seedScenes = await ctx.db.table("scenes").list({ where: { status: "seed" } });
    expect(seedScenes.every((s) => s.styleProfileId === house.id)).toBe(true);
    const prefs = (await ctx.db.table("user_preferences").first({}))!;
    expect(prefs.data.activeStyleProfileId).toBe(house.id);
  });

  it("moves an existing workspace's seeds and untouched defaults to Elsewhere Volume I", async () => {
    const legacy = ctxFor(LEGACY);
    await ensureBootstrap(legacy);
    // Recreate a version 1 workspace: no Volume I preset, everything on Elsewhere Original.
    const profiles = legacy.db.table("style_profiles");
    const original = (await profiles.first({ where: { presetKey: "elsewhere-original" } }))!;
    const house = (await profiles.first({ where: { presetKey: "elsewhere-volume-i" } }))!;
    const custom = (await profiles.first({ where: { presetKey: "cosmic-minimalism" } }))!;
    await profiles.delete(house.id);
    await legacy.db.table("scenes").updateWhere({ status: "seed" }, { styleProfileId: original.id });
    await legacy.db.table("collections").updateWhere({ isSeed: true }, { styleProfileId: original.id });
    const prefsTable = legacy.db.table("user_preferences");
    const before = (await prefsTable.first({}))!;
    await prefsTable.update(before.id, {
      bootstrapVersion: 1,
      data: { ...before.data, activeStyleProfileId: original.id, defaults: { ...before.data.defaults, styleProfileId: custom.id } },
    });

    await ensureBootstrap(legacy);
    const added = (await profiles.first({ where: { presetKey: "elsewhere-volume-i" } }))!;
    expect(added.name).toBe("Elsewhere Volume I");
    const seeds = await legacy.db.table("scenes").list({ where: { status: "seed" } });
    expect(seeds).toHaveLength(20);
    expect(seeds.every((s) => s.styleProfileId === added.id)).toBe(true);
    expect((await legacy.db.table("collections").first({ where: { isSeed: true } }))!.styleProfileId).toBe(added.id);
    const after = (await prefsTable.first({}))!;
    expect(after.bootstrapVersion).toBe(2);
    expect(after.data.activeStyleProfileId).toBe(added.id);
    // A default the artist chose themselves is left alone.
    expect(after.data.defaults.styleProfileId).toBe(custom.id);
    expect(await profiles.get(original.id)).not.toBeNull();
  });

  it("keeps each user's data separate in the local store", async () => {
    const other = ctxFor(OTHER);
    expect(await other.db.table("style_profiles").count()).toBe(0);
    await ensureBootstrap(other);
    expect(await other.db.table("style_profiles").count()).toBe(7);
    expect(await ctx.db.table("style_profiles").count()).toBe(7);
  });
});

describe("generation lifecycle", () => {
  it("runs queued → completed with stored originals, thumbnails, usage and prompt history", async () => {
    const s = await ctx.db.table("scenes").insert({ ...scene(), status: "draft", origin: "studio", seriesIndex: null, archived: false });
    const res = await startGeneration(ctx, {
      idempotencyKey: idem(),
      sceneId: s.id,
      scene: scene({ output: { count: 2 } }),
      operation: "generate",
      parentGenerationId: null,
      instruction: "",
      useReferences: true,
      confirmedCost: false,
    });
    expect(res.job.status).toBe("queued");
    expect(res.generations).toHaveLength(2);
    expect(res.generations[0].prompt).toContain("No collage");
    const job = await waitForJob(res.job.id);
    expect(job.status).toBe("completed");

    const gens = await ctx.db.table("generations").list({ where: { jobId: job.id } });
    for (const g of gens) {
      expect(g.status).toBe("completed");
      expect(g.isDevPlaceholder).toBe(true);
      expect(g.styleSnapshot?.name).toBe("Elsewhere Volume I");
      const asset = (await ctx.db.table("assets").get(g.assetId!))!;
      const full = await ctx.storage.get("generations", asset.path);
      const thumb = await ctx.storage.get("generations", asset.thumbPath!);
      expect((await sharp(full!).metadata()).width).toBe(asset.width);
      expect((await sharp(thumb!).metadata()).format).toBe("webp");
    }
    expect(await ctx.db.table("usage_records").count({ where: { jobId: job.id } })).toBe(1);
    expect(await ctx.db.table("prompt_versions").count({ where: { sceneId: s.id } })).toBe(1);
  });

  it("returns the original job for a repeated idempotency key", async () => {
    const k = idem();
    const req = { idempotencyKey: k, sceneId: null, scene: scene(), operation: "generate" as const, parentGenerationId: null, instruction: "", useReferences: true, confirmedCost: false };
    const a = await startGeneration(ctx, req);
    const b = await startGeneration(ctx, req);
    expect(b.job.id).toBe(a.job.id);
    expect(await ctx.db.table("generation_jobs").count({ where: { idempotencyKey: k } })).toBe(1);
    await waitForJob(a.job.id);
  });

  it("creates variations linked to their parent and root", async () => {
    const [parent] = await ctx.db.table("generations").list({ where: { status: "completed" }, limit: 1 });
    const res = await startGeneration(ctx, {
      idempotencyKey: idem(),
      sceneId: parent.sceneId,
      scene: parent.sceneSnapshot!,
      operation: "variation",
      parentGenerationId: parent.id,
      instruction: "move the fox right",
      useReferences: true,
      confirmedCost: false,
    });
    await waitForJob(res.job.id);
    const v = (await ctx.db.table("generations").get(res.generations[0].id))!;
    expect(v.parentId).toBe(parent.id);
    expect(v.rootId).toBe(parent.rootId ?? parent.id);
    expect(v.prompt).toContain("variation");
  });

  it("cancels an in-flight job without producing images", async () => {
    const res = await startGeneration(ctx, { idempotencyKey: idem(), sceneId: null, scene: scene(), operation: "generate", parentGenerationId: null, instruction: "", useReferences: true, confirmedCost: false });
    await cancelJob(ctx, res.job.id);
    const job = await waitForJob(res.job.id);
    expect(job.status).toBe("cancelled");
    const g = (await ctx.db.table("generations").get(res.generations[0].id))!;
    expect(g.status).toBe("cancelled");
    expect(g.assetId).toBeNull();
  });

  it("rejects without deleting, and deletes permanently only on request", async () => {
    const [g] = await ctx.db.table("generations").list({ where: { status: "completed" }, limit: 1 });
    await updateGenerationMeta(ctx, g.id, { reviewStatus: "rejected", tags: ["Night", "fox"] });
    const after = (await ctx.db.table("generations").get(g.id))!;
    expect(after.reviewStatus).toBe("rejected");
    expect(after.tags).toEqual(["night", "fox"]);
    expect(await ctx.db.table("taggings").count({ where: { targetId: g.id } })).toBe(2);

    // A reference made from this image shares its file; the file survives until both are gone.
    const profile = (await ctx.db.table("style_profiles").first({ where: { presetKey: "elsewhere-volume-i" } }))!;
    const ref = await referenceFromGeneration(ctx, { generationId: g.id, profileId: profile.id, role: "style" });
    const asset = (await ctx.db.table("assets").get(g.assetId!))!;
    await deleteGenerationPermanently(ctx, g.id);
    expect(await ctx.db.table("generations").get(g.id)).toBeNull();
    expect(await ctx.db.table("assets").get(asset.id)).not.toBeNull();
    expect(await ctx.storage.get("generations", asset.path)).not.toBeNull();
    await ctx.db.table("reference_images").delete(ref.id);
    await deleteAssetIfUnused(ctx, ref.assetId);
    expect(await ctx.db.table("generations").get(g.id)).toBeNull();
    expect(await ctx.db.table("assets").get(asset.id)).toBeNull();
    expect(await ctx.storage.get("generations", asset.path)).toBeNull();
  });
});

describe("style references from existing images", () => {
  it("attaches an image to a Style DNA without copying its file, idempotently", async () => {
    const [g] = await ctx.db.table("generations").list({ where: { status: "completed" }, limit: 1 });
    const profile = (await ctx.db.table("style_profiles").first({ where: { presetKey: "elsewhere-volume-i" } }))!;
    const assetsBefore = await ctx.db.table("assets").count();

    const a = await referenceFromGeneration(ctx, { generationId: g.id, profileId: profile.id, role: "style" });
    expect(a.assetId).toBe(g.assetId);
    expect(a.label).toBe(g.title);
    expect(a.role).toBe("style");
    expect(await ctx.db.table("assets").count()).toBe(assetsBefore);

    await ctx.db.table("reference_images").update(a.id, { enabled: false });
    const b = await referenceFromGeneration(ctx, { generationId: g.id, profileId: profile.id, role: "texture" });
    expect(b.id).toBe(a.id);
    expect(b.enabled).toBe(true);
    expect(b.role).toBe("texture");
    expect(await ctx.db.table("reference_images").count({ where: { assetId: g.assetId! } })).toBe(1);

    // Deleting the reference never removes the original image's file.
    await ctx.db.table("reference_images").delete(a.id);
    await deleteAssetIfUnused(ctx, a.assetId);
    const asset = (await ctx.db.table("assets").get(g.assetId!))!;
    expect(asset).not.toBeNull();
    expect(await ctx.storage.get("generations", asset.path)).not.toBeNull();
  });

  it("refuses images without a file and unknown profiles", async () => {
    const [g] = await ctx.db.table("generations").list({ where: { status: "completed" }, limit: 1 });
    await expect(referenceFromGeneration(ctx, { generationId: g.id, profileId: "00000000-0000-4000-8000-000000000000", role: "style" })).rejects.toBeInstanceOf(HttpError);
    const [cancelled] = await ctx.db.table("generations").list({ where: { status: "cancelled" }, limit: 1 });
    const profile = (await ctx.db.table("style_profiles").first({}))!;
    await expect(referenceFromGeneration(ctx, { generationId: cancelled.id, profileId: profile.id, role: "style" })).rejects.toBeInstanceOf(HttpError);
  });
});

describe("spending safeguards", () => {
  const provider = {
    id: "test-priced",
    label: "Priced test provider",
    isConfigured: () => true,
    configurationHint: () => "",
    defaultModel: () => "priced-model",
    models: () => [
      {
        id: "priced-model",
        label: "Priced model",
        description: "",
        provider: "test-priced",
        capabilities: {
          textToImage: true,
          referenceImages: false,
          maxReferenceImages: 0,
          editing: true,
          sizes: { mode: "fixed" as const, options: [{ width: 1024, height: 1024 }] },
          qualities: ["high" as const],
          formats: ["png" as const],
          transparency: false,
          maxImagesPerRequest: 4,
        },
        pricing: { kind: "per-image" as const, table: { high: { "1024x1024": 0.75 } } },
      },
    ],
    run: async () => ({ images: [{ data: await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#222" } }).png().toBuffer(), mimeType: "image/png" }] }),
  };

  beforeAll(() => {
    IMAGE_PROVIDERS.push(provider);
  });
  afterAll(() => {
    IMAGE_PROVIDERS.splice(IMAGE_PROVIDERS.indexOf(provider), 1);
  });

  const priced = (count: number, confirmedCost = false) => ({
    idempotencyKey: idem(),
    sceneId: null,
    scene: scene({ output: { provider: "test-priced", model: "priced-model", quality: "high", count, aspectRatio: "1:1" } }),
    operation: "generate" as const,
    parentGenerationId: null,
    instruction: "",
    useReferences: true,
    confirmedCost,
  });

  it("asks for confirmation above the cost threshold", async () => {
    await expect(startGeneration(ctx, priced(2))).rejects.toMatchObject({ code: "confirm_cost" });
    const ok = await startGeneration(ctx, priced(2, true));
    const job = await waitForJob(ok.job.id);
    expect(job.status).toBe("completed");
    const usage = await ctx.db.table("usage_records").first({ where: { jobId: job.id } });
    expect(usage?.images).toBe(1);
  });

  it("enforces the daily image limit", async () => {
    const prefs = (await ctx.db.table("user_preferences").first({}))!;
    await ctx.db.table("user_preferences").update(prefs.id, { data: { ...prefs.data, limits: { ...prefs.data.limits, dailyImageLimit: 1 } } });
    const err = await startGeneration(ctx, priced(1, true)).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.code).toBe("daily_limit");
    await ctx.db.table("user_preferences").update(prefs.id, { data: prefs.data });
  });

  it("enforces the monthly budget", async () => {
    const prefs = (await ctx.db.table("user_preferences").first({}))!;
    await ctx.db.table("user_preferences").update(prefs.id, { data: { ...prefs.data, limits: { ...prefs.data.limits, monthlyBudgetUsd: 0.5 } } });
    await expect(startGeneration(ctx, priced(1, true))).rejects.toMatchObject({ code: "budget_exceeded" });
    await ctx.db.table("user_preferences").update(prefs.id, { data: prefs.data });
  });
});

describe("storage", () => {
  it("rejects path traversal and non-images", async () => {
    await expect(ctx.storage.put("generations", "../../escape.txt", Buffer.from("x"), "text/plain")).rejects.toThrow(/Invalid storage path/);
    await expect(saveImageAsset(ctx, "reference", Buffer.from("not an image"), "image/png")).rejects.toThrow(/not a readable image/);
    await expect(saveImageAsset(ctx, "reference", Buffer.from("x"), "application/pdf")).rejects.toThrow(/Unsupported image type/);
  });

  it("extracts dominant colours and writes a thumbnail for references", async () => {
    const png = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#2e3a24" } }).png().toBuffer();
    const asset = await saveImageAsset(ctx, "reference", png, "image/png");
    expect(asset.dominantColors[0]).toBe("#2e3a24");
    expect(asset.path.startsWith(`${USER}/`)).toBe(true);
  });
});

describe("schema parity", () => {
  it("maps every repository field to a column in the Supabase migration", async () => {
    const [tagged] = await ctx.db.table("generations").list({ where: { status: "completed" }, limit: 1 });
    await updateGenerationMeta(ctx, tagged.id, { tags: ["parity"] });
    const sql = readdirSync(path.resolve(__dirname, "../../supabase/migrations"))
      .map((f) => readFileSync(path.resolve(__dirname, "../../supabase/migrations", f), "utf8"))
      .join("\n");
    const tables = ["profiles", "user_preferences", "style_profiles", "style_profile_versions", "assets", "scenes", "generations", "generation_jobs", "collections", "collection_items", "tags", "taggings", "usage_records", "prompt_versions"] as const;
    for (const t of tables) {
      const block = sql.match(new RegExp(`create table public\\.${t} \\(([\\s\\S]*?)\\n\\);`))?.[1];
      expect(block, `table ${t} in migration`).toBeTruthy();
      const columns = new Set([...block!.matchAll(/^\s+([a-z_]+)\s/gm)].map((m) => m[1]));
      const rows = await ctx.db.table(t).list({ limit: 5 });
      expect(rows.length, `sample rows for ${t}`).toBeGreaterThan(0);
      for (const row of rows) for (const k of Object.keys(row)) expect(columns.has(toSnake(k)), `${t}.${toSnake(k)}`).toBe(true);
    }
  });
});
