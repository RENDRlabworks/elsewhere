import { z } from "zod";
import {
  ANCHORS,
  ASPECT_RATIOS,
  BACKGROUNDS,
  CAMERA_ANGLES,
  CHARACTER_KINDS,
  COMPOSITION_PRESETS,
  DIRECTIONS,
  FORMATS,
  GENERATION_KINDS,
  JOB_STATUSES,
  MOVEMENTS,
  PALETTE_MODES,
  QUALITIES,
  REFERENCE_ROLES,
  RELATIONSHIPS,
  REVIEW_CRITERIA,
  REVIEW_STATUSES,
  TIMES_OF_DAY,
} from "./vocab";

const shortText = z.string().max(400).default("");
const longText = z.string().max(4000).default("");
const id = z.string().min(1).max(64);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a #RRGGBB colour");

/* -------------------------------------------------------------------------- */
/* Style DNA                                                                  */
/* -------------------------------------------------------------------------- */

export const STYLE_TEXT_ATTRIBUTES = [
  "medium",
  "renderingStyle",
  "photographic",
  "exposure",
  "contrast",
  "shadowDepth",
  "lighting",
  "colorPhilosophy",
  "saturation",
  "texture",
  "grain",
  "atmosphericDepth",
  "compositionPhilosophy",
  "subjectTreatment",
  "environmentalTreatment",
  "emotionalCharacter",
  "positiveInstructions",
  "negativeConstraints",
] as const;
export const STYLE_LIST_ATTRIBUTES = ["requiredElements", "prohibitedElements"] as const;
export const STYLE_ATTRIBUTE_KEYS = [...STYLE_TEXT_ATTRIBUTES, ...STYLE_LIST_ATTRIBUTES] as const;
export type StyleAttributeKey = (typeof STYLE_ATTRIBUTE_KEYS)[number];

export const STYLE_ATTRIBUTE_LABELS: Record<StyleAttributeKey, string> = {
  medium: "Artistic medium",
  renderingStyle: "Rendering style",
  photographic: "Photographic characteristics",
  exposure: "Exposure",
  contrast: "Contrast",
  shadowDepth: "Shadow depth",
  lighting: "Lighting",
  colorPhilosophy: "Color philosophy",
  saturation: "Color saturation",
  texture: "Texture",
  grain: "Grain",
  atmosphericDepth: "Atmospheric depth",
  compositionPhilosophy: "Composition philosophy",
  subjectTreatment: "Subject treatment",
  environmentalTreatment: "Environmental treatment",
  emotionalCharacter: "Emotional characteristics",
  requiredElements: "Required visual elements",
  prohibitedElements: "Prohibited visual elements",
  positiveInstructions: "Positive style instructions",
  negativeConstraints: "Negative constraints",
};

export const styleAttributesSchema = z.object({
  medium: longText,
  renderingStyle: longText,
  photographic: longText,
  exposure: longText,
  contrast: longText,
  shadowDepth: longText,
  lighting: longText,
  colorPhilosophy: longText,
  saturation: longText,
  texture: longText,
  grain: longText,
  atmosphericDepth: longText,
  compositionPhilosophy: longText,
  subjectTreatment: longText,
  environmentalTreatment: longText,
  emotionalCharacter: longText,
  requiredElements: z.array(z.string().max(200)).max(40).default([]),
  prohibitedElements: z.array(z.string().max(200)).max(60).default([]),
  positiveInstructions: longText,
  negativeConstraints: longText,
});
export type StyleAttributes = z.infer<typeof styleAttributesSchema>;

export const swatchSchema = z.object({
  id: z.string().min(1).max(40),
  hex,
  locked: z.boolean().default(false),
  name: z.string().max(60).optional(),
});
export type Swatch = z.infer<typeof swatchSchema>;

export const styleSnapshotSchema = z.object({
  name: z.string(),
  description: z.string(),
  attributes: styleAttributesSchema,
  defaultPalette: z.array(swatchSchema),
});
export type StyleSnapshot = z.infer<typeof styleSnapshotSchema>;

export type StyleProfile = {
  id: string;
  userId: string;
  name: string;
  description: string;
  attributes: StyleAttributes;
  lockedAttributes: StyleAttributeKey[];
  locked: boolean;
  archived: boolean;
  presetKey: string | null;
  defaultPalette: Swatch[];
  currentVersion: number;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StyleProfileVersion = {
  id: string;
  userId: string;
  profileId: string;
  version: number;
  snapshot: StyleSnapshot;
  createdAt: string;
};

export const styleProfileCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(1000).default(""),
  attributes: styleAttributesSchema.partial().default({}),
  defaultPalette: z.array(swatchSchema).max(12).default([]),
});

export const styleProfileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(1000).optional(),
  attributes: styleAttributesSchema.partial().optional(),
  defaultPalette: z.array(swatchSchema).max(12).optional(),
  archived: z.boolean().optional(),
});

export const styleLockSchema = z.object({
  locked: z.boolean().optional(),
  lockedAttributes: z.array(z.enum(STYLE_ATTRIBUTE_KEYS)).optional(),
});

/* -------------------------------------------------------------------------- */
/* Assets and references                                                      */
/* -------------------------------------------------------------------------- */

export type AssetKind = "generation" | "reference" | "import";

export type Asset = {
  id: string;
  userId: string;
  kind: AssetKind;
  bucket: string;
  path: string;
  thumbPath: string | null;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  dominantColors: string[];
  createdAt: string;
};

export type ReferenceImage = {
  id: string;
  userId: string;
  profileId: string | null;
  assetId: string;
  role: (typeof REFERENCE_ROLES)[number];
  label: string;
  notes: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export const referenceUpdateSchema = z.object({
  role: z.enum(REFERENCE_ROLES).optional(),
  label: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
  enabled: z.boolean().optional(),
  profileId: z.string().nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Scenes                                                                     */
/* -------------------------------------------------------------------------- */

export const characterSchema = z.object({
  kind: z.enum(CHARACTER_KINDS).default("traveler"),
  label: z.string().max(120).default(""),
  action: shortText,
  pose: shortText,
  direction: z.enum(DIRECTIONS).default("unspecified"),
  movement: z.enum(MOVEMENTS).default("still"),
  silhouetteStrength: z.number().min(0).max(100).default(60),
  clothing: shortText,
  count: z.number().int().min(1).max(12).default(1),
  relationship: z.enum(RELATIONSHIPS).default("dwarfed"),
});
export type Character = z.infer<typeof characterSchema>;

export const compositionSchema = z.object({
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.72),
  anchor: z.enum(ANCHORS).default("lower-center"),
  preset: z.enum(COMPOSITION_PRESETS).nullable().default("extreme-negative-space"),
  cameraAngle: z.enum(CAMERA_ANGLES).default("eye-level"),
  /** Approximate subject height as a percentage of the frame height. */
  subjectHeight: z.number().min(0.5).max(90).default(4),
  environmentalScale: z.number().min(0).max(100).default(85),
  scaleExaggeration: z.number().min(0).max(100).default(70),
  cameraDistance: z.number().min(0).max(100).default(75),
  depth: z.number().min(0).max(100).default(70),
  foregroundScale: z.number().min(0).max(100).default(40),
});
export type Composition = z.infer<typeof compositionSchema>;

export const paletteSchema = z.object({
  mode: z.enum(PALETTE_MODES).default("material"),
  swatches: z.array(swatchSchema).max(12).default([]),
  saturation: z.number().min(-100).max(100).default(0),
  warmth: z.number().min(-100).max(100).default(0),
  contrast: z.number().min(-100).max(100).default(0),
  sourceReferenceId: z.string().nullable().default(null),
  savedPaletteId: z.string().nullable().default(null),
});
export type ScenePalette = z.infer<typeof paletteSchema>;

export const outputSchema = z.object({
  provider: z.string().max(40).default("openai"),
  model: z.string().max(80).nullable().default(null),
  aspectRatio: z.enum(ASPECT_RATIOS).default("4:5"),
  /** Long edge in pixels. Mapped to provider-supported dimensions server-side. */
  longEdge: z.number().int().min(512).max(3840).default(1536),
  quality: z.enum(QUALITIES).default("high"),
  format: z.enum(FORMATS).default("png"),
  background: z.enum(BACKGROUNDS).default("auto"),
  count: z.number().int().min(1).max(4).default(1),
});
export type OutputSettings = z.infer<typeof outputSchema>;

export const SCENE_FIELDS = [
  "title",
  "description",
  "environment",
  "subject",
  "secondarySubject",
  "naturalElement",
  "phenomenon",
  "emotionalTone",
  "atmosphere",
  "timeOfDay",
  "materials",
  "lighting",
  "composition",
  "palette",
] as const;
export type SceneField = (typeof SCENE_FIELDS)[number];

export const sceneContentSchema = z.object({
  title: z.string().max(160).default("Untitled scene"),
  description: longText,
  freeDirection: longText,
  environment: shortText,
  subject: characterSchema.default(characterSchema.parse({})),
  secondarySubject: characterSchema.nullable().default(null),
  naturalElement: shortText,
  phenomenon: shortText,
  emotionalTone: shortText,
  atmosphere: shortText,
  timeOfDay: z.enum(TIMES_OF_DAY).default("unspecified"),
  materials: shortText,
  lighting: shortText,
  composition: compositionSchema.default(compositionSchema.parse({})),
  palette: paletteSchema.default(paletteSchema.parse({})),
  styleProfileId: z.string().nullable().default(null),
  referenceIds: z.array(id).max(16).default([]),
  output: outputSchema.default(outputSchema.parse({})),
  promptOverride: z.string().max(32000).nullable().default(null),
  promptTemplateId: z.string().nullable().default(null),
  lockedFields: z.array(z.enum(SCENE_FIELDS)).default([]),
});
export type SceneContent = z.infer<typeof sceneContentSchema>;

export type SceneStatus = "draft" | "concept" | "seed";

export type Scene = SceneContent & {
  id: string;
  userId: string;
  status: SceneStatus;
  origin: "studio" | "explore" | "seed" | "restore";
  seriesIndex: number | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export const sceneCreateSchema = sceneContentSchema.partial().extend({
  status: z.enum(["draft", "concept"]).default("draft"),
  origin: z.enum(["studio", "explore", "restore"]).default("studio"),
});
export const sceneUpdateSchema = sceneContentSchema.partial().extend({
  status: z.enum(["draft", "concept"]).optional(),
  archived: z.boolean().optional(),
});

/* -------------------------------------------------------------------------- */
/* Palettes, templates, prompt versions                                       */
/* -------------------------------------------------------------------------- */

export type SavedPalette = {
  id: string;
  userId: string;
  name: string;
  swatches: Swatch[];
  mode: (typeof PALETTE_MODES)[number];
  materials: string[];
  createdAt: string;
  updatedAt: string;
};

export const savedPaletteCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  swatches: z.array(swatchSchema).min(1).max(12),
  mode: z.enum(PALETTE_MODES).default("custom"),
  materials: z.array(z.string().max(80)).max(20).default([]),
});

export type PromptTemplate = {
  id: string;
  userId: string;
  name: string;
  description: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export const promptTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).default(""),
  body: z.string().min(1).max(32000),
});

export type PromptSection = { key: string; label: string; text: string; locked?: boolean };

export type PromptVersion = {
  id: string;
  userId: string;
  sceneId: string;
  text: string;
  sections: PromptSection[];
  isManual: boolean;
  source: "assembled" | "manual" | "refined" | "generation";
  generationId: string | null;
  createdAt: string;
};

export const promptVersionCreateSchema = z.object({
  text: z.string().min(1).max(32000),
  sections: z.array(z.object({ key: z.string(), label: z.string(), text: z.string() })).default([]),
  isManual: z.boolean().default(false),
  source: z.enum(["assembled", "manual", "refined"]).default("assembled"),
});

/* -------------------------------------------------------------------------- */
/* Generations                                                                */
/* -------------------------------------------------------------------------- */

export type GenerationUsage = {
  inputTokens?: number;
  outputTokens?: number;
  imageInputTokens?: number;
  imageOutputTokens?: number;
  textInputTokens?: number;
};

export type Generation = {
  id: string;
  userId: string;
  sceneId: string | null;
  jobId: string | null;
  parentId: string | null;
  rootId: string | null;
  kind: (typeof GENERATION_KINDS)[number];
  source: "generated" | "imported";
  status: (typeof JOB_STATUSES)[number];
  title: string;
  prompt: string;
  promptSections: PromptSection[];
  sceneSnapshot: SceneContent | null;
  styleProfileId: string | null;
  styleVersionId: string | null;
  styleSnapshot: StyleSnapshot | null;
  referenceIds: string[];
  referencesSubmitted: boolean;
  provider: string | null;
  model: string | null;
  outputSettings: OutputSettings | null;
  width: number | null;
  height: number | null;
  assetId: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  costUsd: number | null;
  costEstimated: boolean;
  usage: GenerationUsage | null;
  rating: number;
  favorite: boolean;
  reviewStatus: (typeof REVIEW_STATUSES)[number];
  notes: string;
  tags: string[];
  searchText: string;
  variationIndex: number;
  isDevPlaceholder: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type GenerationJob = {
  id: string;
  userId: string;
  sceneId: string | null;
  status: (typeof JOB_STATUSES)[number];
  operation: "generate" | "variation" | "refine";
  provider: string;
  model: string;
  requestedCount: number;
  idempotencyKey: string;
  request: Record<string, unknown>;
  error: string | null;
  attempts: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const generationRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(80),
  sceneId: z.string().nullable().default(null),
  scene: sceneContentSchema,
  operation: z.enum(["generate", "variation", "refine"]).default("generate"),
  parentGenerationId: z.string().nullable().default(null),
  /** For refine/variation: extra direction for this run only. */
  instruction: z.string().max(2000).default(""),
  useReferences: z.boolean().default(true),
  /** User confirmed a cost above their confirmation threshold. */
  confirmedCost: z.boolean().default(false),
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export const generationUpdateSchema = z.object({
  title: z.string().max(160).optional(),
  notes: z.string().max(4000).optional(),
  rating: z.number().int().min(0).max(5).optional(),
  favorite: z.boolean().optional(),
  reviewStatus: z.enum(REVIEW_STATUSES).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
});

export const generationListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  filter: z.enum(["all", "favorites", "unreviewed", "accepted", "rejected"]).default("all"),
  collectionId: z.string().optional(),
  sceneId: z.string().optional(),
  styleProfileId: z.string().optional(),
  character: z.string().optional(),
  environment: z.string().optional(),
  model: z.string().optional(),
  paletteHex: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(["completed", "active", "failed", "any"]).default("any"),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  offset: z.coerce.number().int().min(0).default(0),
});
export type GenerationListQuery = z.infer<typeof generationListQuerySchema>;

/* -------------------------------------------------------------------------- */
/* Collections                                                                */
/* -------------------------------------------------------------------------- */

export const COLLECTION_VIEWS = ["masonry", "grid", "editorial", "filmstrip", "list"] as const;
export type CollectionView = (typeof COLLECTION_VIEWS)[number];

export type Collection = {
  id: string;
  userId: string;
  name: string;
  description: string;
  notes: string;
  coverGenerationId: string | null;
  styleProfileId: string | null;
  tags: string[];
  targetCount: number | null;
  viewMode: CollectionView;
  isSeed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CollectionItem = {
  id: string;
  userId: string;
  collectionId: string;
  generationId: string | null;
  sceneId: string | null;
  position: number;
  createdAt: string;
};

export const collectionCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).default(""),
  styleProfileId: z.string().nullable().default(null),
  tags: z.array(z.string().max(40)).max(20).default([]),
  targetCount: z.number().int().min(1).max(500).nullable().default(null),
});

export const collectionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(8000).optional(),
  coverGenerationId: z.string().nullable().optional(),
  styleProfileId: z.string().nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  targetCount: z.number().int().min(1).max(500).nullable().optional(),
  viewMode: z.enum(COLLECTION_VIEWS).optional(),
});

export const collectionItemsAddSchema = z.object({
  generationIds: z.array(z.string()).min(1).max(200),
});
export const collectionItemsReorderSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(1000),
});
export const collectionItemsRemoveSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(500),
});
export const collectionItemsMoveSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(500),
  targetCollectionId: z.string(),
});

/* -------------------------------------------------------------------------- */
/* Tags, reviews, usage                                                       */
/* -------------------------------------------------------------------------- */

export type Tag = { id: string; userId: string; name: string; createdAt: string };
export type Tagging = {
  id: string;
  userId: string;
  tagId: string;
  targetType: "generation" | "collection";
  targetId: string;
  createdAt: string;
};

export const criteriaScoresSchema = z.partialRecord(z.enum(REVIEW_CRITERIA), z.number().int().min(1).max(5));

export type ImageReview = {
  id: string;
  userId: string;
  generationId: string;
  kind: "manual" | "ai";
  criteria: Partial<Record<(typeof REVIEW_CRITERIA)[number], number>>;
  summary: string;
  findings: { criterion: string; note: string }[];
  driftDetected: boolean;
  suggestions: string[];
  repetitionNotes: string;
  model: string | null;
  styleVersionId: string | null;
  createdAt: string;
};

export const manualReviewSchema = z.object({
  criteria: criteriaScoresSchema,
  summary: z.string().max(4000).default(""),
});

export const aiReviewOutputSchema = z.object({
  summary: z.string(),
  criteria: z.object(Object.fromEntries(REVIEW_CRITERIA.map((c) => [c, z.number().int().min(1).max(5)])) as Record<
    (typeof REVIEW_CRITERIA)[number],
    z.ZodNumber
  >),
  findings: z.array(z.object({ criterion: z.string(), note: z.string() })),
  driftDetected: z.boolean(),
  suggestions: z.array(z.string()),
  repetitionNotes: z.string(),
});
export type AiReviewOutput = z.infer<typeof aiReviewOutputSchema>;

export type UsageRecord = {
  id: string;
  userId: string;
  jobId: string | null;
  generationId: string | null;
  provider: string;
  model: string;
  kind: "image" | "text";
  images: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  estimated: boolean;
  createdAt: string;
};

/* -------------------------------------------------------------------------- */
/* Preferences                                                                */
/* -------------------------------------------------------------------------- */

export const preferencesSchema = z.object({
  defaults: z
    .object({
      styleProfileId: z.string().nullable().default(null),
      aspectRatio: z.enum(ASPECT_RATIOS).default("4:5"),
      longEdge: z.number().int().min(512).max(3840).default(1536),
      quality: z.enum(QUALITIES).default("high"),
      format: z.enum(FORMATS).default("png"),
      provider: z.string().default("openai"),
      model: z.string().nullable().default(null),
      textModel: z.string().nullable().default(null),
    })
    .default({
      styleProfileId: null,
      aspectRatio: "4:5",
      longEdge: 1536,
      quality: "high",
      format: "png",
      provider: "openai",
      model: null,
      textModel: null,
    }),
  limits: z
    .object({
      dailyImageLimit: z.number().int().min(0).max(10000).default(60),
      monthlyBudgetUsd: z.number().min(0).max(100000).default(50),
      maxImagesPerRequest: z.number().int().min(1).max(4).default(4),
      confirmAboveUsd: z.number().min(0).max(1000).default(1),
    })
    .default({ dailyImageLimit: 60, monthlyBudgetUsd: 50, maxImagesPerRequest: 4, confirmAboveUsd: 1 }),
  ui: z
    .object({
      theme: z.enum(["dark", "black"]).default("dark"),
      galleryDensity: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
      canvasBackground: z.enum(["app", "black", "gray", "white", "checker"]).default("app"),
      reduceMotion: z.boolean().default(false),
      sidebarCollapsed: z.boolean().default(false),
    })
    .default({
      theme: "dark",
      galleryDensity: "comfortable",
      canvasBackground: "app",
      reduceMotion: false,
      sidebarCollapsed: false,
    }),
  autosave: z
    .object({ enabled: z.boolean().default(true), delayMs: z.number().int().min(300).max(10000).default(900) })
    .default({ enabled: true, delayMs: 900 }),
  shortcuts: z.record(z.string(), z.string()).default({}),
  lastSceneId: z.string().nullable().default(null),
  activeStyleProfileId: z.string().nullable().default(null),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const preferencesPatchSchema = z.object({
  defaults: preferencesSchema.shape.defaults.unwrap().partial().optional(),
  limits: preferencesSchema.shape.limits.unwrap().partial().optional(),
  ui: preferencesSchema.shape.ui.unwrap().partial().optional(),
  autosave: preferencesSchema.shape.autosave.unwrap().partial().optional(),
  shortcuts: z.record(z.string(), z.string()).optional(),
  lastSceneId: z.string().nullable().optional(),
  activeStyleProfileId: z.string().nullable().optional(),
});

export type UserPreferences = {
  id: string;
  userId: string;
  data: Preferences;
  bootstrapVersion: number;
  createdAt: string;
  updatedAt: string;
};

/* -------------------------------------------------------------------------- */
/* Explore concepts                                                           */
/* -------------------------------------------------------------------------- */

export const CONCEPT_VARIABLES = [
  "character",
  "action",
  "environment",
  "naturalElement",
  "material",
  "scale",
  "phenomenon",
  "composition",
  "emotionalTone",
  "lighting",
  "palette",
  "atmosphere",
] as const;
export type ConceptVariable = (typeof CONCEPT_VARIABLES)[number];

export const conceptSchema = z.object({
  title: z.string().min(1).max(120),
  logline: z.string().max(400),
  character: z.enum(CHARACTER_KINDS),
  characterLabel: z.string().max(120),
  action: z.string().max(200),
  environment: z.string().max(300),
  naturalElement: z.string().max(120),
  material: z.string().max(200),
  scale: z.string().max(200),
  subjectHeight: z.number().min(0.5).max(90),
  phenomenon: z.string().max(300),
  composition: z.enum(COMPOSITION_PRESETS),
  anchor: z.enum(ANCHORS),
  emotionalTone: z.string().max(120),
  lighting: z.string().max(200),
  timeOfDay: z.enum(TIMES_OF_DAY),
  palette: z.array(hex).min(3).max(6),
  paletteName: z.string().max(80),
  atmosphere: z.string().max(200),
});
export type Concept = z.infer<typeof conceptSchema>;

export const conceptRequestSchema = z.object({
  mode: z.enum(["randomize-all", "randomize-unlocked", "surprise", "batch", "similar", "new-direction"]),
  count: z.number().int().min(1).max(5).default(1),
  locked: z.partialRecord(z.enum(CONCEPT_VARIABLES), z.unknown()).default({}),
  base: conceptSchema.nullable().default(null),
  seed: z.number().int().optional(),
  useAi: z.boolean().default(false),
  styleProfileId: z.string().nullable().default(null),
});

export { hex as hexSchema };
