import "server-only";
import { after } from "next/server";
import { createHash } from "node:crypto";
import {
  type Generation,
  type GenerationJob,
  type GenerationRequest,
  type ImageReview,
  type Preferences,
  type SceneContent,
  type StyleProfile,
  type StyleSnapshot,
} from "@/lib/domain/schemas";
import { COMPOSITION_PRESET_OPTIONS } from "@/lib/domain/vocab";
import { assemblePrompt } from "@/lib/prompt/assemble";
import { effectiveSwatches } from "@/lib/palette/engine";
import { costFromUsage, estimateCost, resolveSize, supportedQuality } from "@/lib/providers/image/models";
import { resolveModel, resolveProvider } from "@/lib/providers/image/registry";
import { ProviderError, type ImageModelConfig, type InputImage, type ProviderRequest } from "@/lib/providers/image/types";
import type { ServerContext } from "@/lib/server/context";
import { env } from "@/lib/server/env";
import { conflict, HttpError, notFound } from "@/lib/server/http";
import type { Bucket } from "@/lib/storage";
import { deleteAsset, saveImageAsset } from "./assets";
import { currentVersion } from "./styles";
import { buildSearchText, setTags } from "./tags";

const ACTIVE = ["queued", "generating", "processing"] as const;
const STALE_AFTER_MS = 10 * 60 * 1000;
const MAX_ACTIVE_JOBS = 3;

/**
 * Run work after the response is sent (Vercel keeps the function alive via
 * waitUntil). Outside a request scope, for example in tests or scripts, the
 * work simply runs in the background of the current process.
 */
function scheduleAfterResponse(fn: () => Promise<void>) {
  try {
    after(fn);
  } catch {
    void fn();
  }
}

/** In-process abort handles so cancellation can stop an in-flight provider request. */
const g = globalThis as unknown as { __elsewhereAborts?: Map<string, AbortController> };
g.__elsewhereAborts ??= new Map();
const aborts = g.__elsewhereAborts;

export type GenerationPlan = {
  provider: string;
  model: ImageModelConfig;
  width: number;
  height: number;
  quality: ProviderRequest["quality"];
  format: ProviderRequest["format"];
  background: ProviderRequest["background"];
  n: number;
  prompt: string;
  sections: ReturnType<typeof assemblePrompt>["sections"];
  isManualPrompt: boolean;
  style: { profile: StyleProfile | null; versionId: string | null; snapshot: StyleSnapshot | null };
  referenceIds: string[];
  referencesSubmitted: boolean;
  sourceGenerationId: string | null;
  estimateUsd: number | null;
  estimateBasis: "provider-pricing" | "recent-average" | "free" | "unknown";
  notes: string[];
};

function startOfDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function startOfMonth() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function getPreferences(ctx: ServerContext): Promise<Preferences> {
  const row = await ctx.db.table("user_preferences").first({});
  if (!row) throw new HttpError(409, "Workspace is not initialised yet. Reload to finish setup.", "not_bootstrapped");
  return row.data;
}

/**
 * Work out exactly what will be sent to the provider, without side effects.
 * Used both for the cost/capability preview and for real submissions.
 */
export async function planGeneration(ctx: ServerContext, req: GenerationRequest): Promise<GenerationPlan> {
  const prefs = await getPreferences(ctx);
  const scene: SceneContent = req.scene;
  const notes: string[] = [];

  const provider = resolveProvider(scene.output.provider || prefs.defaults.provider);
  if (!provider) {
    throw new HttpError(503, "No image provider is configured. Add OPENAI_API_KEY to enable generation.", "no_provider");
  }
  if (scene.output.provider && provider.id !== scene.output.provider) {
    notes.push(
      provider.id === "dev"
        ? "No image provider is configured, so a labelled development sketch will be rendered instead."
        : `${scene.output.provider} is not configured; using ${provider.label}.`,
    );
  }
  const model = resolveModel(provider, provider.id === scene.output.provider ? scene.output.model || prefs.defaults.model : null);
  if (model.unverified) notes.push(`${model.id} is not in the model registry; conservative settings are used.`);

  // Style DNA snapshot
  let profile: StyleProfile | null = null;
  let versionId: string | null = null;
  let snapshot: StyleSnapshot | null = null;
  const styleId = scene.styleProfileId ?? prefs.activeStyleProfileId;
  if (styleId) {
    profile = await ctx.db.table("style_profiles").get(styleId);
    if (profile) {
      const v = await currentVersion(ctx, profile);
      versionId = v.id;
      snapshot = v.snapshot;
    }
  }

  // Source image for variations and refinements
  let sourceGenerationId: string | null = null;
  if (req.operation !== "generate") {
    if (!req.parentGenerationId) throw new HttpError(400, "Variations and refinements need a source image.");
    const parent = await ctx.db.table("generations").get(req.parentGenerationId);
    if (!parent?.assetId) throw notFound("Source image");
    if (!model.capabilities.editing) throw new HttpError(400, `${model.label} cannot edit or vary images.`, "unsupported");
    sourceGenerationId = parent.id;
  }

  // References: only submitted when the model genuinely supports image conditioning.
  let referenceIds: string[] = [];
  let referencesSubmitted = false;
  const requestedRefs = req.useReferences ? scene.referenceIds : [];
  if (requestedRefs.length) {
    const refs = await ctx.db.table("reference_images").list({ where: { id: { in: requestedRefs } } });
    const ordered = requestedRefs.map((id) => refs.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
    if (!model.capabilities.referenceImages) {
      notes.push(`${model.label} does not accept reference images, so ${ordered.length} reference${ordered.length === 1 ? " was" : "s were"} not submitted.`);
    } else {
      const room = model.capabilities.maxReferenceImages - (sourceGenerationId ? 1 : 0);
      if (ordered.length > room) notes.push(`Only the first ${room} references can be submitted to ${model.label}.`);
      referenceIds = ordered.slice(0, Math.max(0, room)).map((r) => r.id);
      referencesSubmitted = referenceIds.length > 0;
    }
  }
  const refRows = referenceIds.length ? await ctx.db.table("reference_images").list({ where: { id: { in: referenceIds } } }) : [];

  // Prompt
  let template: string | null = null;
  if (scene.promptTemplateId) template = (await ctx.db.table("prompt_templates").get(scene.promptTemplateId))?.body ?? null;
  const assembled = assemblePrompt({
    scene,
    style: snapshot,
    lockedStyleKeys: profile?.lockedAttributes,
    styleLocked: profile?.locked,
    references: referenceIds.map((id) => {
      const r = refRows.find((x) => x.id === id)!;
      return { role: r.role, label: r.label };
    }),
    template,
    operation: req.operation,
    instruction: req.instruction,
  });

  // Output settings mapped to provider capabilities
  const size = resolveSize(model.capabilities.sizes, scene.output.aspectRatio, scene.output.longEdge);
  notes.push(...size.notes);
  const q = supportedQuality(model, scene.output.quality);
  if (q.note) notes.push(q.note);
  let format = scene.output.format;
  if (!model.capabilities.formats.includes(format)) {
    notes.push(`${format.toUpperCase()} is not supported; using PNG.`);
    format = "png";
  }
  let background = scene.output.background;
  if (background === "transparent") {
    if (!model.capabilities.transparency) {
      notes.push(`${model.label} does not support transparent backgrounds; using an opaque background.`);
      background = "auto";
    } else if (format === "jpeg") {
      notes.push("Transparency requires PNG or WebP; switched the format to PNG.");
      format = "png";
    }
  }
  const n = Math.max(1, Math.min(scene.output.count, prefs.limits.maxImagesPerRequest, model.capabilities.maxImagesPerRequest));
  if (n < scene.output.count) notes.push(`Image count limited to ${n} for this request.`);

  // Cost estimate: provider pricing when known, otherwise the user's own recent average for the same model.
  let estimateUsd: number | null = null;
  let estimateBasis: GenerationPlan["estimateBasis"] = "unknown";
  if (provider.id === "dev") {
    estimateUsd = 0;
    estimateBasis = "free";
  } else {
    estimateUsd = estimateCost(model, q.quality, size.width, size.height, n);
    if (estimateUsd != null) estimateBasis = "provider-pricing";
    else {
      const recent = await ctx.db.table("usage_records").list({
        where: { model: model.id, kind: "image", costUsd: { notNull: true } },
        order: [{ field: "createdAt", ascending: false }],
        limit: 10,
      });
      const perImage = recent.filter((r) => r.images > 0).map((r) => (r.costUsd ?? 0) / r.images);
      if (perImage.length >= 2) {
        estimateUsd = (perImage.reduce((a, b) => a + b, 0) / perImage.length) * n;
        estimateBasis = "recent-average";
      }
    }
  }

  return {
    provider: provider.id,
    model,
    width: size.width,
    height: size.height,
    quality: q.quality,
    format,
    background,
    n,
    prompt: assembled.text,
    sections: assembled.sections,
    isManualPrompt: assembled.isManual,
    style: { profile, versionId, snapshot },
    referenceIds,
    referencesSubmitted,
    sourceGenerationId,
    estimateUsd,
    estimateBasis,
    notes,
  };
}

/** Enforce daily image limits, the monthly budget and cost confirmation. */
async function assertWithinLimits(ctx: ServerContext, prefs: Preferences, plan: GenerationPlan, confirmed: boolean) {
  if (plan.provider === "dev") return;
  const usage = ctx.db.table("usage_records");
  const today = await usage.list({ where: { kind: "image", createdAt: { gte: startOfDay() } }, select: ["images", "costUsd"] });
  const imagesToday = today.reduce((a, r) => a + r.images, 0);
  const dailyLimit = Math.min(prefs.limits.dailyImageLimit, env.hardDailyImageCap);
  if (imagesToday + plan.n > dailyLimit) {
    throw new HttpError(
      429,
      `Daily limit reached: ${imagesToday} of ${dailyLimit} images used today. Adjust the limit in Settings.`,
      "daily_limit",
      { imagesToday, dailyLimit },
    );
  }
  const month = await usage.list({ where: { createdAt: { gte: startOfMonth() } }, select: ["costUsd"] });
  const spent = month.reduce((a, r) => a + (r.costUsd ?? 0), 0);
  if (prefs.limits.monthlyBudgetUsd > 0 && spent + (plan.estimateUsd ?? 0) > prefs.limits.monthlyBudgetUsd) {
    throw new HttpError(
      402,
      `Monthly budget of $${prefs.limits.monthlyBudgetUsd.toFixed(2)} would be exceeded ($${spent.toFixed(2)} spent). Raise it in Settings to continue.`,
      "budget_exceeded",
      { spent, budget: prefs.limits.monthlyBudgetUsd },
    );
  }
  if (!confirmed && plan.estimateUsd != null && plan.estimateUsd > prefs.limits.confirmAboveUsd) {
    throw conflict(`This request is estimated at $${plan.estimateUsd.toFixed(2)}. Confirm to continue.`, "confirm_cost", {
      estimateUsd: plan.estimateUsd,
      basis: plan.estimateBasis,
    });
  }
}

function sanitiseRequest(req: GenerationRequest) {
  return { ...req, scene: { ...req.scene } } as unknown as Record<string, unknown>;
}

export async function startGeneration(ctx: ServerContext, req: GenerationRequest) {
  const jobs = ctx.db.table("generation_jobs");
  await sweepStaleJobs(ctx);

  // Idempotency: a repeated submission returns the original job.
  const dup = await jobs.first({ where: { idempotencyKey: req.idempotencyKey } });
  if (dup) {
    const gens = await ctx.db.table("generations").list({ where: { jobId: dup.id }, order: [{ field: "variationIndex" }] });
    return { job: dup, generations: gens, notes: ["Duplicate submission ignored; showing the original request."], plan: null };
  }
  const active = await jobs.count({ where: { status: { in: [...ACTIVE] } } });
  if (active >= MAX_ACTIVE_JOBS) {
    throw new HttpError(429, `${active} generations are already running. Wait for one to finish.`, "too_many_active");
  }

  const prefs = await getPreferences(ctx);
  const plan = await planGeneration(ctx, req);
  await assertWithinLimits(ctx, prefs, plan, req.confirmedCost);

  const job = await jobs.insert({
    sceneId: req.sceneId,
    status: "queued",
    operation: req.operation,
    provider: plan.provider,
    model: plan.model.id,
    requestedCount: plan.n,
    idempotencyKey: req.idempotencyKey,
    request: sanitiseRequest(req),
    error: null,
    attempts: 0,
    startedAt: null,
    finishedAt: null,
  });

  const parent = plan.sourceGenerationId ? await ctx.db.table("generations").get(plan.sourceGenerationId) : null;
  const scene = req.scene;
  const swatches = effectiveSwatches(scene.palette);
  const base = {
    sceneId: req.sceneId,
    jobId: job.id,
    parentId: parent?.id ?? null,
    rootId: parent ? (parent.rootId ?? parent.id) : null,
    kind: req.operation,
    source: "generated" as const,
    status: "queued" as const,
    title: scene.title,
    prompt: plan.prompt,
    promptSections: plan.sections,
    sceneSnapshot: scene,
    styleProfileId: plan.style.profile?.id ?? null,
    styleVersionId: plan.style.versionId,
    styleSnapshot: plan.style.snapshot,
    referenceIds: plan.referenceIds,
    referencesSubmitted: plan.referencesSubmitted,
    provider: plan.provider,
    model: plan.model.id,
    outputSettings: { ...scene.output, quality: plan.quality, format: plan.format, background: plan.background, count: plan.n },
    width: plan.width,
    height: plan.height,
    assetId: null,
    errorMessage: null,
    durationMs: null,
    costUsd: null,
    costEstimated: true,
    usage: null,
    rating: 0,
    favorite: false,
    reviewStatus: "unreviewed" as const,
    notes: "",
    tags: [] as string[],
    characterKind: scene.subject.kind,
    environment: scene.environment,
    paletteHexes: swatches,
    isDevPlaceholder: plan.provider === "dev",
    completedAt: null,
  };
  const generations = await ctx.db.table("generations").insertMany(
    Array.from({ length: plan.n }, (_, i) => {
      const row = { ...base, variationIndex: i, searchText: "" };
      row.searchText = buildSearchText(row);
      return row;
    }),
  );

  if (req.sceneId) {
    await ctx.db
      .table("prompt_versions")
      .insert({
        sceneId: req.sceneId,
        text: plan.prompt,
        sections: plan.sections,
        isManual: plan.isManualPrompt,
        source: "generation",
        generationId: generations[0]?.id ?? null,
      })
      .catch(() => {});
  }

  scheduleAfterResponse(() => processJob(ctx, job.id, plan));
  return { job, generations, notes: plan.notes, plan };
}

async function loadInput(ctx: ServerContext, assetId: string, name: string): Promise<InputImage | null> {
  const asset = await ctx.db.table("assets").get(assetId);
  if (!asset) return null;
  const data = await ctx.storage.get(asset.bucket as Bucket, asset.path);
  return data ? { data, mimeType: asset.mimeType, name } : null;
}

async function setJob(ctx: ServerContext, id: string, patch: Partial<GenerationJob>) {
  return ctx.db.table("generation_jobs").update(id, patch);
}

async function isCancelled(ctx: ServerContext, jobId: string) {
  return (await ctx.db.table("generation_jobs").get(jobId))?.status === "cancelled";
}

export async function processJob(ctx: ServerContext, jobId: string, plan: GenerationPlan) {
  const gens = ctx.db.table("generations");
  const started = Date.now();
  const controller = new AbortController();
  aborts.set(jobId, controller);
  try {
    if (await isCancelled(ctx, jobId)) return;
    await setJob(ctx, jobId, { status: "generating", startedAt: new Date().toISOString(), attempts: 1 });
    await gens.updateWhere({ jobId }, { status: "generating" });

    const references: InputImage[] = [];
    for (const [i, refId] of plan.referenceIds.entries()) {
      const ref = await ctx.db.table("reference_images").get(refId);
      const input = ref ? await loadInput(ctx, ref.assetId, `reference-${i + 1}.png`) : null;
      if (input) references.push(input);
    }
    let source: InputImage | null = null;
    if (plan.sourceGenerationId) {
      const parent = await gens.get(plan.sourceGenerationId);
      source = parent?.assetId ? await loadInput(ctx, parent.assetId, "source.png") : null;
      if (!source) throw new ProviderError("The source image could not be loaded.");
    }

    const job = await ctx.db.table("generation_jobs").get(jobId);
    const scene = (job?.request as { scene?: SceneContent } | undefined)?.scene;
    const provider = resolveProvider(plan.provider);
    if (!provider) throw new ProviderError("The provider is no longer configured.");

    const result = await provider.run(
      {
        model: plan.model.id,
        prompt: plan.prompt,
        width: plan.width,
        height: plan.height,
        quality: plan.quality,
        format: plan.format,
        background: plan.background,
        n: plan.n,
        references,
        source,
        operation: (job?.operation ?? "generate") as ProviderRequest["operation"],
        safetyIdentifier: createHash("sha256").update(ctx.userId).digest("hex").slice(0, 32),
        hints: scene
          ? {
              title: scene.title,
              x: scene.composition.x,
              y: scene.composition.y,
              subjectHeight: scene.composition.subjectHeight,
              hasSubject: scene.subject.kind !== "none",
              swatches: effectiveSwatches(scene.palette),
              composition: COMPOSITION_PRESET_OPTIONS.find((o) => o.key === scene.composition.preset)?.label ?? "",
              seed: parseInt(createHash("md5").update(jobId).digest("hex").slice(0, 8), 16),
            }
          : undefined,
      },
      controller.signal,
    );

    if (await isCancelled(ctx, jobId)) return;
    await setJob(ctx, jobId, { status: "processing" });
    await gens.updateWhere({ jobId }, { status: "processing" });

    const durationMs = Date.now() - started;
    const { cost, estimated } = plan.provider === "dev" ? { cost: 0, estimated: false } : costFromUsage(plan.model, result.usage);
    const perImageCost = cost != null ? cost / result.images.length : null;
    const rows = await gens.list({ where: { jobId }, order: [{ field: "variationIndex" }] });

    for (const [i, row] of rows.entries()) {
      const image = result.images[i];
      if (!image) {
        await gens.update(row.id, { status: "failed", errorMessage: "The provider returned fewer images than requested." });
        continue;
      }
      const asset = await saveImageAsset(ctx, "generation", image.data, image.mimeType);
      await gens.update(row.id, {
        status: "completed",
        assetId: asset.id,
        width: asset.width,
        height: asset.height,
        durationMs,
        costUsd: perImageCost,
        costEstimated: estimated,
        usage: i === 0 ? (result.usage ?? null) : null,
        isDevPlaceholder: !!result.placeholder,
        completedAt: new Date().toISOString(),
      });
    }

    await ctx.db.table("usage_records").insert({
      jobId,
      generationId: rows[0]?.id ?? null,
      provider: plan.provider,
      model: plan.model.id,
      kind: "image",
      images: result.images.length,
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      costUsd: cost,
      estimated,
    });
    await setJob(ctx, jobId, { status: "completed", finishedAt: new Date().toISOString(), error: null });
  } catch (err) {
    const cancelled = controller.signal.aborted || (await isCancelled(ctx, jobId).catch(() => false));
    const message = cancelled ? "Cancelled" : err instanceof Error ? err.message : String(err);
    await setJob(ctx, jobId, {
      status: cancelled ? "cancelled" : "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    }).catch(() => {});
    await gens
      .updateWhere({ jobId, status: { in: [...ACTIVE] } }, { status: cancelled ? "cancelled" : "failed", errorMessage: message })
      .catch(() => {});
    if (!cancelled) console.error(`[elsewhere] job ${jobId} failed: ${message}`);
  } finally {
    aborts.delete(jobId);
  }
}

export async function cancelJob(ctx: ServerContext, jobId: string) {
  const job = await ctx.db.table("generation_jobs").get(jobId);
  if (!job) throw notFound("Job");
  if (!ACTIVE.includes(job.status as (typeof ACTIVE)[number])) return job;
  const updated = await setJob(ctx, jobId, { status: "cancelled", finishedAt: new Date().toISOString(), error: "Cancelled" });
  await ctx.db.table("generations").updateWhere({ jobId, status: { in: [...ACTIVE] } }, { status: "cancelled", errorMessage: "Cancelled" });
  aborts.get(jobId)?.abort();
  return updated;
}

export async function retryJob(ctx: ServerContext, jobId: string, idempotencyKey: string) {
  const job = await ctx.db.table("generation_jobs").get(jobId);
  if (!job) throw notFound("Job");
  const req = job.request as unknown as GenerationRequest;
  return startGeneration(ctx, { ...req, idempotencyKey, confirmedCost: true });
}

/** Mark jobs interrupted by a server restart or timeout as failed, so nothing spins forever. */
export async function sweepStaleJobs(ctx: ServerContext) {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const stale = await ctx.db.table("generation_jobs").list({ where: { status: { in: [...ACTIVE] }, updatedAt: { lte: cutoff } } });
  for (const job of stale) {
    const message = "Interrupted before completion. Retry to run it again.";
    await setJob(ctx, job.id, { status: "failed", error: message, finishedAt: new Date().toISOString() });
    await ctx.db.table("generations").updateWhere({ jobId: job.id, status: { in: [...ACTIVE] } }, { status: "failed", errorMessage: message });
  }
}

export async function updateGenerationMeta(
  ctx: ServerContext,
  id: string,
  patch: Partial<Pick<Generation, "title" | "notes" | "rating" | "favorite" | "reviewStatus" | "tags">>,
) {
  const gens = ctx.db.table("generations");
  const current = await gens.get(id);
  if (!current) throw notFound("Image");
  const next: Partial<Generation> = { ...patch };
  if (patch.tags) next.tags = await setTags(ctx, "generation", id, patch.tags);
  next.searchText = buildSearchText({ ...current, ...next } as Generation);
  return gens.update(id, next);
}

/** Permanently delete an image, its file and dependent records. Rejection never calls this. */
export async function deleteGenerationPermanently(ctx: ServerContext, id: string) {
  const gens = ctx.db.table("generations");
  const gen = await gens.get(id);
  if (!gen) throw notFound("Image");
  const items = await ctx.db.table("collection_items").list({ where: { generationId: id } });
  for (const item of items) {
    if (item.sceneId) await ctx.db.table("collection_items").update(item.id, { generationId: null });
    else await ctx.db.table("collection_items").delete(item.id);
  }
  await ctx.db.table("collections").updateWhere({ coverGenerationId: id }, { coverGenerationId: null });
  await ctx.db.table("image_reviews").deleteWhere({ generationId: id } as Partial<ImageReview>);
  await ctx.db.table("taggings").deleteWhere({ targetType: "generation", targetId: id });
  await gens.updateWhere({ parentId: id }, { parentId: null });
  await ctx.db.table("prompt_versions").updateWhere({ generationId: id }, { generationId: null });
  await gens.delete(id);
  await deleteAsset(ctx, gen.assetId);
}
