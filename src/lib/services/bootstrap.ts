import "server-only";
import { characterSchema, compositionSchema, outputSchema, paletteSchema, preferencesSchema, type Preferences, type UserPreferences } from "@/lib/domain/schemas";
import { ANCHOR_POINTS } from "@/lib/domain/vocab";
import type { ServerContext } from "@/lib/server/context";
import { PHOTOGRAPHIC_PRESET, REPAINTED_PRESET_KEYS, STYLE_PRESETS } from "@/lib/style/presets";
import { VOLUME_ONE, VOLUME_ONE_DESCRIPTION, VOLUME_ONE_NAME } from "@/lib/seed/volume-one";
import { createStyleProfile, updateStyleProfile } from "./styles";

/** Increment when new seed content must be added to existing accounts. */
export const BOOTSTRAP_VERSION = 3;

const inflight = new Map<string, Promise<UserPreferences>>();

/**
 * Idempotently provision a user's workspace: preferences, the seven Style DNA
 * presets, and the "Elsewhere: Volume I" collection with its 20 scene records.
 */
export function ensureBootstrap(ctx: ServerContext): Promise<UserPreferences> {
  const key = `${ctx.mode}:${ctx.userId}`;
  let p = inflight.get(key);
  if (!p) {
    p = run(ctx).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

const isUniqueViolation = (err: unknown) => err instanceof Error && /duplicate key|unique constraint|23505/i.test(err.message);

async function run(ctx: ServerContext): Promise<UserPreferences> {
  const prefsTable = ctx.db.table("user_preferences");
  let prefs = await prefsTable.first({});
  if (prefs && prefs.bootstrapVersion >= BOOTSTRAP_VERSION) return prefs;

  if (!prefs) {
    try {
      prefs = await prefsTable.insert({ data: preferencesSchema.parse({}), bootstrapVersion: 0 });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      prefs = (await prefsTable.first({}))!;
    }
  }

  if (!(await ctx.db.table("profiles").first({}))) {
    await ctx.db
      .table("profiles")
      .insert({ displayName: ctx.email?.split("@")[0] ?? "Artist" })
      .catch((err) => {
        if (!isUniqueViolation(err)) throw err;
      });
  }

  // Style DNA presets
  const existing = await ctx.db.table("style_profiles").list({ where: { presetKey: { notNull: true } } });
  const byKey = new Map(existing.map((p) => [p.presetKey!, p]));
  for (const preset of STYLE_PRESETS) {
    if (byKey.has(preset.key)) continue;
    try {
      const created = await createStyleProfile(ctx, {
        name: preset.name,
        description: preset.description,
        attributes: preset.attributes,
        defaultPalette: preset.defaultPalette,
        presetKey: preset.key,
      });
      byKey.set(preset.key, created);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  const original = byKey.get("elsewhere-original") ?? null;
  // The house style: written from the Volume I originals. Seeds and defaults use it.
  const house = byKey.get("elsewhere-volume-i") ?? original;

  // Elsewhere: Volume I
  const seedCollection = await ctx.db.table("collections").first({ where: { isSeed: true } });
  if (!seedCollection) {
    let collection;
    try {
      collection = await ctx.db.table("collections").insert({
        name: VOLUME_ONE_NAME,
        description: VOLUME_ONE_DESCRIPTION,
        notes: "",
        coverGenerationId: null,
        styleProfileId: house?.id ?? null,
        tags: ["original", "volume-i"],
        targetCount: 20,
        viewMode: "editorial",
        isSeed: true,
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
    if (collection) {
      const scenes = await ctx.db.table("scenes").insertMany(
        VOLUME_ONE.map((s) => {
          const [x, y] = s.anchor === "custom" ? [0.5, 0.5] : ANCHOR_POINTS[s.anchor];
          return {
            title: s.title,
            description: s.description,
            freeDirection: "",
            environment: s.environment,
            subject: characterSchema.parse({
              kind: s.character,
              label: s.label ?? "",
              action: s.action,
              movement: s.movement ?? "still",
              relationship: s.subjectHeight <= 3 ? "dwarfed" : "observing",
            }),
            secondarySubject: null,
            naturalElement: s.naturalElement,
            phenomenon: s.phenomenon,
            emotionalTone: s.tone,
            atmosphere: s.atmosphere,
            timeOfDay: s.time,
            materials: s.materials,
            lighting: s.lighting,
            composition: compositionSchema.parse({ preset: s.preset, anchor: s.anchor, x, y, subjectHeight: s.subjectHeight }),
            palette: paletteSchema.parse({
              mode: "material",
              swatches: s.palette.map((hex, i) => ({ id: `v1-${s.index}-${i}`, hex, locked: false })),
            }),
            styleProfileId: house?.id ?? null,
            referenceIds: [],
            output: outputSchema.parse({}),
            promptOverride: null,
            promptTemplateId: null,
            lockedFields: [],
            status: "seed" as const,
            origin: "seed" as const,
            seriesIndex: s.index,
            archived: false,
          };
        }),
      );
      await ctx.db.table("collection_items").insertMany(
        scenes
          .sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0))
          .map((scene, i) => ({ collectionId: collection.id, generationId: null, sceneId: scene.id, position: i })),
      );
    }
  }

  // v2: move seeded records and untouched defaults from Elsewhere Original to Elsewhere Volume I.
  const migrateToHouse = prefs.bootstrapVersion < 2 && house && original && house.id !== original.id;
  if (migrateToHouse) {
    await ctx.db.table("scenes").updateWhere({ status: "seed", styleProfileId: original.id }, { styleProfileId: house.id });
    await ctx.db.table("collections").updateWhere({ isSeed: true, styleProfileId: original.id }, { styleProfileId: house.id });
  }
  // v3: the themed presets move to the painterly Volume I medium and the photographic
  // original is renamed. Only untouched presets change; edited or locked ones are
  // left exactly as the artist has them. Each change is a new version, so history stays.
  if (prefs.bootstrapVersion < 3) {
    for (const key of REPAINTED_PRESET_KEYS) {
      const profile = byKey.get(key);
      const preset = STYLE_PRESETS.find((p) => p.key === key);
      if (!profile || !preset || profile.currentVersion !== 1 || profile.locked || profile.lockedAttributes.length) continue;
      await updateStyleProfile(ctx, profile.id, { name: preset.name, description: preset.description, attributes: preset.attributes }).catch(() => {});
    }
    const photographic = byKey.get(PHOTOGRAPHIC_PRESET.key);
    const renamed = STYLE_PRESETS.find((p) => p.key === PHOTOGRAPHIC_PRESET.key)!.name;
    if (photographic && photographic.name === PHOTOGRAPHIC_PRESET.previousName && !photographic.locked) {
      await updateStyleProfile(ctx, photographic.id, { name: renamed }).catch(() => {});
    }
  }

  const fromDefault = (id: string | null) => (!id || (migrateToHouse && id === original?.id) ? (house?.id ?? null) : id);

  const data: Preferences = preferencesSchema.parse({
    ...prefs.data,
    defaults: { ...prefs.data.defaults, styleProfileId: fromDefault(prefs.data.defaults.styleProfileId) },
    activeStyleProfileId: fromDefault(prefs.data.activeStyleProfileId),
  });
  return prefsTable.update(prefs.id, { data, bootstrapVersion: BOOTSTRAP_VERSION });
}
