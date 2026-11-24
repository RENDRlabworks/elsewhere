import "server-only";
import {
  styleAttributesSchema,
  type StyleAttributeKey,
  type StyleAttributes,
  type StyleProfile,
  type StyleProfileVersion,
  type Swatch,
} from "@/lib/domain/schemas";
import type { ServerContext } from "@/lib/server/context";
import { conflict, notFound } from "@/lib/server/http";
import { applyStylePatch, snapshotOf, StyleLockError, type StylePatch } from "@/lib/style/locking";

export async function createStyleProfile(
  ctx: ServerContext,
  input: { name: string; description: string; attributes: Partial<StyleAttributes>; defaultPalette: Swatch[]; presetKey?: string | null },
): Promise<StyleProfile> {
  const profiles = ctx.db.table("style_profiles");
  const profile = await profiles.insert({
    name: input.name,
    description: input.description,
    attributes: styleAttributesSchema.parse(input.attributes),
    lockedAttributes: [],
    locked: false,
    archived: false,
    presetKey: input.presetKey ?? null,
    defaultPalette: input.defaultPalette,
    currentVersion: 0,
    currentVersionId: null,
  });
  return createVersion(ctx, profile);
}

/** Write an immutable snapshot of the profile and point the profile at it. */
async function createVersion(ctx: ServerContext, profile: StyleProfile): Promise<StyleProfile> {
  const version = profile.currentVersion + 1;
  const row = await ctx.db.table("style_profile_versions").insert({
    profileId: profile.id,
    version,
    snapshot: snapshotOf(profile),
  });
  return ctx.db.table("style_profiles").update(profile.id, { currentVersion: version, currentVersionId: row.id });
}

export async function getStyleProfile(ctx: ServerContext, id: string) {
  const p = await ctx.db.table("style_profiles").get(id);
  if (!p) throw notFound("Style profile");
  return p;
}

export async function updateStyleProfile(ctx: ServerContext, id: string, patch: StylePatch & { archived?: boolean }) {
  const profile = await getStyleProfile(ctx, id);
  let result: ReturnType<typeof applyStylePatch>;
  try {
    result = applyStylePatch(profile, patch);
  } catch (err) {
    if (err instanceof StyleLockError) throw conflict(err.message, "style_locked", { attributes: err.attributes });
    throw err;
  }
  let updated = profile;
  if (result.changed) {
    updated = await ctx.db.table("style_profiles").update(id, {
      name: result.next.name,
      description: result.next.description,
      attributes: result.next.attributes,
      defaultPalette: result.next.defaultPalette,
    });
    updated = await createVersion(ctx, updated);
  }
  if (patch.archived !== undefined && patch.archived !== updated.archived) {
    updated = await ctx.db.table("style_profiles").update(id, { archived: patch.archived });
  }
  return updated;
}

export async function setStyleLocks(ctx: ServerContext, id: string, locks: { locked?: boolean; lockedAttributes?: StyleAttributeKey[] }) {
  await getStyleProfile(ctx, id);
  const patch: Partial<StyleProfile> = {};
  if (locks.locked !== undefined) patch.locked = locks.locked;
  if (locks.lockedAttributes) patch.lockedAttributes = [...new Set(locks.lockedAttributes)];
  return ctx.db.table("style_profiles").update(id, patch);
}

export async function duplicateStyleProfile(ctx: ServerContext, id: string, name?: string) {
  const src = await getStyleProfile(ctx, id);
  return createStyleProfile(ctx, {
    name: name ?? `${src.name} copy`,
    description: src.description,
    attributes: src.attributes,
    defaultPalette: src.defaultPalette.map((s, i) => ({ ...s, id: `${s.id}-c${i}` })),
  });
}

export async function currentVersion(ctx: ServerContext, profile: StyleProfile): Promise<StyleProfileVersion> {
  if (profile.currentVersionId) {
    const v = await ctx.db.table("style_profile_versions").get(profile.currentVersionId);
    if (v) return v;
  }
  const repaired = await createVersion(ctx, profile);
  return (await ctx.db.table("style_profile_versions").get(repaired.currentVersionId!))!;
}
