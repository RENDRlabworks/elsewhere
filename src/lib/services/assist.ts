import "server-only";
import sharp from "sharp";
import { z } from "zod";
import {
  aiReviewOutputSchema,
  conceptSchema,
  type Character,
  STYLE_ATTRIBUTE_LABELS,
  type Concept,
  type ConceptVariable,
  type PromptSection,
  type SceneContent,
  type StyleAttributeKey,
} from "@/lib/domain/schemas";
import { CHARACTER_KINDS, COMPOSITION_PRESETS, REVIEW_CRITERIA_OPTIONS } from "@/lib/domain/vocab";
import { generateConcepts, historyFromScenes, type ConceptMode } from "@/lib/explore/engine";
import { fieldValue, IDEA_FIELD_LABELS, localIdeas, type IdeaField } from "@/lib/explore/ideas";
import { assemblePrompt, ensureOutputRequirements } from "@/lib/prompt/assemble";
import { structuredCompletion, textAssistAvailable } from "@/lib/providers/text";
import type { ServerContext } from "@/lib/server/context";
import { HttpError, notFound } from "@/lib/server/http";
import type { Bucket } from "@/lib/storage";
import { getPreferences } from "./generations";
import { currentVersion } from "./styles";

async function recentScenes(ctx: ServerContext, limit = 300): Promise<SceneContent[]> {
  const [gens, scenes] = await Promise.all([
    ctx.db.table("generations").list({ order: [{ field: "createdAt", ascending: false }], limit, select: ["sceneSnapshot"] }),
    ctx.db.table("scenes").list({ order: [{ field: "updatedAt", ascending: false }], limit: 100 }),
  ]);
  return [...gens.map((g) => g.sceneSnapshot).filter((s): s is SceneContent => !!s), ...scenes];
}

function applyLocks(c: Concept, base: Concept | null, locked: Partial<Record<ConceptVariable, unknown>>): Concept {
  if (!base) return c;
  const out = { ...c };
  const set = <K extends keyof Concept>(k: K) => {
    out[k] = base[k];
  };
  for (const v of Object.keys(locked) as ConceptVariable[]) {
    switch (v) {
      case "character":
        set("character");
        set("characterLabel");
        break;
      case "action":
        set("action");
        break;
      case "environment":
        set("environment");
        break;
      case "naturalElement":
        set("naturalElement");
        break;
      case "material":
        set("material");
        break;
      case "scale":
        set("scale");
        set("subjectHeight");
        break;
      case "phenomenon":
        set("phenomenon");
        break;
      case "composition":
        set("composition");
        set("anchor");
        break;
      case "emotionalTone":
        set("emotionalTone");
        break;
      case "lighting":
        set("lighting");
        break;
      case "palette":
        set("palette");
        set("paletteName");
        break;
      case "atmosphere":
        set("atmosphere");
        break;
    }
  }
  return conceptSchema.parse(out);
}

export async function generateConceptBatch(
  ctx: ServerContext,
  req: {
    mode: ConceptMode;
    count: number;
    locked: Partial<Record<ConceptVariable, unknown>>;
    base: Concept | null;
    seed?: number;
    useAi: boolean;
    styleProfileId: string | null;
  },
): Promise<{ concepts: Concept[]; source: "engine" | "ai"; model?: string }> {
  const history = historyFromScenes(await recentScenes(ctx));
  const seed = req.seed ?? Math.floor(Math.random() * 2 ** 31);
  const count = req.mode === "batch" ? 5 : req.count;

  if (!req.useAi) {
    return { concepts: generateConcepts(req.mode, { seed, count, history, locked: req.locked, base: req.base }), source: "engine" };
  }
  if (!textAssistAvailable()) throw new HttpError(503, "AI concepts need OPENAI_API_KEY. The built-in engine works without it.", "no_provider");

  const prefs = await getPreferences(ctx);
  const style = req.styleProfileId ? await ctx.db.table("style_profiles").get(req.styleProfileId) : null;
  const overused = (r: Record<string, number>) =>
    Object.entries(r)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, n]) => `${k} (${n})`)
      .join("; ");
  const lockedLines = req.base
    ? Object.keys(req.locked)
        .map((k) => `- ${k}: ${JSON.stringify((req.base as Record<string, unknown>)[k === "scale" ? "scale" : k] ?? "")}`)
        .join("\n")
    : "";
  const modeBrief: Record<ConceptMode, string> = {
    "randomize-all": "Invent fresh, unrelated concepts.",
    "randomize-unlocked": "Keep locked variables exactly; reinvent everything else.",
    surprise: "Be unexpected. Favour unusual characters, rare phenomena and compositions not in the overused lists.",
    batch: "Five concepts that are distinctly different from each other.",
    similar: "Stay close to the base concept: same world, varied details.",
    "new-direction": "Move far from the base concept on every unlocked variable.",
  };
  const schema = z.object({ concepts: z.array(conceptSchema) });
  const result = await structuredCompletion({
    schema,
    name: "elsewhere_concepts",
    model: prefs.defaults.textModel,
    system: [
      "You are the creative director of Elsewhere: surreal fine-art imagery of familiar things in impossible natural worlds. The medium and rendering come from the Style DNA, not from you.",
      "Impossibility comes from scale, gravity, perspective, time and environmental relationships, not from simply enlarging an object every time.",
      "Avoid generic fantasy art, neon, magical glows, excessive stars and nebulae. Keep concepts simple, quiet and believable within their own world.",
      `character must be one of: ${CHARACTER_KINDS.join(", ")}. composition must be one of: ${COMPOSITION_PRESETS.join(", ")}.`,
      "Vary subject placement (anchor); do not default to lower-left. Palettes are 3 to 6 #rrggbb colours derived from the scene's materials, dark-weighted and restrained.",
    ].join("\n"),
    user: [
      `Mode: ${modeBrief[req.mode]}`,
      `Return exactly ${count} concept${count > 1 ? "s" : ""}.`,
      style ? `Style DNA "${style.name}": ${style.description}\nEmotional character: ${style.attributes.emotionalCharacter}` : "",
      req.base ? `Base concept:\n${JSON.stringify(req.base)}` : "",
      lockedLines ? `Locked variables (must stay identical):\n${lockedLines}` : "",
      `Already overused, avoid: characters ${overused(history.character)}; compositions ${overused(history.composition)}; placements ${overused(history.anchor)}; phenomena ${overused(history.phenomenon)}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  // Locks are enforced in code, never trusted to the model.
  const concepts = result.data.concepts.slice(0, count).map((c) => applyLocks(c, req.base, req.locked));
  return { concepts, source: "ai", model: result.model };
}

/** Propose a refined prompt. Locked sections are restored verbatim; nothing is applied automatically. */
export async function refinePrompt(ctx: ServerContext, scene: SceneContent, direction: string) {
  const prefs = await getPreferences(ctx);
  const profile = scene.styleProfileId ? await ctx.db.table("style_profiles").get(scene.styleProfileId) : null;
  const version = profile ? await currentVersion(ctx, profile) : null;
  const assembled = assemblePrompt({
    scene: { ...scene, promptOverride: null },
    style: version?.snapshot ?? null,
    lockedStyleKeys: profile?.lockedAttributes,
    styleLocked: profile?.locked,
  });
  const lockedKeys = new Set(assembled.sections.filter((s) => s.locked).map((s) => s.key));
  const editable = assembled.sections.filter((s) => !lockedKeys.has(s.key) && s.key !== "output");

  const schema = z.object({
    sections: z.array(z.object({ key: z.string(), text: z.string() })),
    rationale: z.string(),
  });
  const res = await structuredCompletion({
    schema,
    name: "elsewhere_prompt_refinement",
    model: prefs.defaults.textModel,
    system:
      "You refine image prompts for surreal fine-art imagery. Improve clarity and specificity using visual language that suits the Style DNA's medium; never change the medium. Keep each section's meaning; do not add text, borders, collages or extra subjects. Return only the editable sections you were given, by key.",
    user: [
      direction ? `Direction from the artist: ${direction}` : "Make the prompt more precise and evocative without changing intent.",
      `Editable sections:\n${editable.map((s) => `[${s.key}] ${s.text}`).join("\n")}`,
      lockedKeys.size ? `These sections are locked and must not be returned: ${[...lockedKeys].join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  const proposed = new Map(res.data.sections.map((s) => [s.key, s.text.trim()]));
  const protectedSections: string[] = [];
  const sections: PromptSection[] = assembled.sections.map((s) => {
    const p = proposed.get(s.key);
    if (lockedKeys.has(s.key) || s.key === "output") {
      if (p && p !== s.text) protectedSections.push(s.label);
      return s;
    }
    return p ? { ...s, text: p } : s;
  });
  const text = ensureOutputRequirements(sections.map((s) => s.text).join("\n\n"));
  return { text, sections, original: assembled.text, rationale: res.data.rationale, protectedSections, model: res.model };
}

/** AI-assisted visual review against Style DNA and references. Advisory only. */
export async function aiReview(ctx: ServerContext, generationId: string) {
  const gen = await ctx.db.table("generations").get(generationId);
  if (!gen?.assetId) throw notFound("Image");
  const prefs = await getPreferences(ctx);
  const asset = await ctx.db.table("assets").get(gen.assetId);
  const bytes = asset ? await ctx.storage.get(asset.bucket as Bucket, asset.path) : null;
  if (!bytes) throw notFound("Image file");
  const small = await sharp(bytes).resize(1024, 1024, { fit: "inside" }).webp({ quality: 85 }).toBuffer();

  const snapshot = gen.styleSnapshot ?? (gen.styleProfileId ? (await ctx.db.table("style_profiles").get(gen.styleProfileId)) : null);
  const refIds = gen.referenceIds.length
    ? gen.referenceIds
    : gen.styleProfileId
      ? (await ctx.db.table("reference_images").list({ where: { profileId: gen.styleProfileId, enabled: true }, limit: 3 })).map((r) => r.id)
      : [];
  const refImages: { data: Buffer; mimeType: string }[] = [];
  for (const id of refIds.slice(0, 3)) {
    const ref = await ctx.db.table("reference_images").get(id);
    const a = ref ? await ctx.db.table("assets").get(ref.assetId) : null;
    const b = a?.thumbPath ? await ctx.storage.get(a.bucket as Bucket, a.thumbPath) : null;
    if (b) refImages.push({ data: b, mimeType: "image/webp" });
  }
  const siblings = gen.sceneId
    ? await ctx.db.table("generations").list({ where: { sceneId: gen.sceneId, status: "completed" }, limit: 12, select: ["sceneSnapshot"] })
    : [];
  const placements = siblings
    .map((s) => s.sceneSnapshot?.composition)
    .filter(Boolean)
    .map((c) => `${c!.anchor}/${c!.preset}`)
    .join(", ");

  const attrs = snapshot && "attributes" in snapshot ? snapshot.attributes : null;
  const rules = attrs
    ? (Object.keys(STYLE_ATTRIBUTE_LABELS) as StyleAttributeKey[])
        .map((k) => {
          const v = attrs[k];
          const s = Array.isArray(v) ? v.join("; ") : v;
          return s ? `${STYLE_ATTRIBUTE_LABELS[k]}: ${s}` : "";
        })
        .filter(Boolean)
        .join("\n")
    : "No Style DNA recorded for this image.";

  const res = await structuredCompletion({
    schema: aiReviewOutputSchema,
    name: "elsewhere_visual_review",
    model: prefs.defaults.textModel,
    images: [{ data: small, mimeType: "image/webp" }, ...refImages],
    system:
      "You are a thoughtful art director reviewing one image against a written Style DNA and optional reference images. Scores are subjective creative guidance from 1 (far off) to 5 (fully realised). Judge the image in the medium its Style DNA asks for: materialRealism means materials read as tangible within that medium, and a painterly image should never be marked down for not looking like a photograph or told to be more realistic unless the Style DNA is photographic. Be specific and concise. Never recommend deleting the image.",
    user: [
      `The first image is the generation under review${refImages.length ? `; the next ${refImages.length} are style references` : ""}.`,
      `Criteria keys: ${REVIEW_CRITERIA_OPTIONS.map((c) => `${c.key} (${c.label})`).join(", ")}.`,
      `Style DNA:\n${rules}`,
      `Prompt used:\n${gen.prompt.slice(0, 4000)}`,
      placements ? `Other images from this scene used these placements/compositions: ${placements}. Note repetition if relevant.` : "",
      "Identify style drift, explain findings per criterion where useful, and suggest concrete prompt improvements.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  const review = await ctx.db.table("image_reviews").insert({
    generationId: gen.id,
    kind: "ai",
    criteria: res.data.criteria,
    summary: res.data.summary,
    findings: res.data.findings,
    driftDetected: res.data.driftDetected,
    suggestions: res.data.suggestions,
    repetitionNotes: res.data.repetitionNotes,
    model: res.model,
    styleVersionId: gen.styleVersionId,
  });
  await ctx.db.table("usage_records").insert({
    jobId: null,
    generationId: gen.id,
    provider: "openai",
    model: res.model,
    kind: "text",
    images: 0,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    costUsd: null,
    estimated: true,
  });
  return review;
}

/** Short summary of the scene for idea prompts, leaving out the field being reinvented. */
function sceneBrief(scene: SceneContent, skip: IdeaField, character: Character) {
  const lines: [IdeaField | "subjectKind", string][] = [
    ["title", scene.title],
    ["description", scene.description],
    ["subjectKind", character.kind],
    ["subjectLabel", character.label],
    ["action", character.action],
    ["pose", character.pose],
    ["clothing", character.clothing],
    ["environment", scene.environment],
    ["phenomenon", scene.phenomenon],
    ["naturalElement", scene.naturalElement],
    ["materials", scene.materials],
    ["lighting", scene.lighting],
    ["atmosphere", scene.atmosphere],
    ["emotionalTone", scene.emotionalTone],
    ["freeDirection", scene.freeDirection],
  ];
  return lines
    .filter(([k, v]) => k !== skip && v && v.trim())
    .map(([k, v]) => `- ${k}: ${v.trim()}`)
    .join("\n");
}

/**
 * Ideas for one free-text field. With AI the ideas are written to fit the rest of
 * the scene and the Style DNA; without it they come from the built-in pools.
 */
export async function generateFieldIdeas(
  ctx: ServerContext,
  req: { field: IdeaField; scene: SceneContent; character: Character | null; count: number; useAi: boolean },
): Promise<{ ideas: string[]; source: "engine" | "ai"; model?: string }> {
  const character = req.character ?? req.scene.subject;
  if (!req.useAi || !textAssistAvailable()) {
    return { ideas: localIdeas(req.field, req.scene, { character, count: req.count }), source: "engine" };
  }
  const prefs = await getPreferences(ctx);
  const style = req.scene.styleProfileId ? await ctx.db.table("style_profiles").get(req.scene.styleProfileId) : null;
  const current = fieldValue(req.field, req.scene, character).trim();
  const result = await structuredCompletion({
    schema: z.object({ ideas: z.array(z.string().min(1).max(300)) }),
    name: "elsewhere_field_ideas",
    model: prefs.defaults.textModel,
    system: [
      "You suggest values for one field of a scene in Elsewhere: surreal fine-art imagery of familiar things in impossible natural worlds.",
      "Impossibility comes from scale, gravity, perspective, time and environmental relationships. Keep ideas simple, quiet and specific; avoid generic fantasy, neon, magical glows and clichés.",
      "Each idea must fit the rest of the scene and must be meaningfully different from the others. Write plain text only: no quotation marks, numbering, markdown or dashes used as punctuation.",
      "Never describe the medium or rendering (painting, photograph, illustration); that comes from the Style DNA.",
    ].join("\n"),
    user: [
      `Field: ${req.field}, ${IDEA_FIELD_LABELS[req.field]}.`,
      `Return exactly ${req.count} ideas.`,
      current ? `Current value, do not repeat it: ${current}` : "",
      style ? `Style DNA "${style.name}": ${style.description}\nEmotional character: ${style.attributes.emotionalCharacter}` : "",
      `The rest of the scene:\n${sceneBrief(req.scene, req.field, character) || "(nothing yet, so invent freely)"}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  const seen = new Set([current.toLowerCase()]);
  const ideas = result.data.ideas
    .map((s) => s.replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/^["'\s]+|["'\s]+$/g, "").trim())
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .slice(0, req.count);
  if (!ideas.length) return { ideas: localIdeas(req.field, req.scene, { character, count: req.count }), source: "engine" };
  return { ideas, source: "ai", model: result.model };
}
