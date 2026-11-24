import "server-only";
import type { ReferenceImage } from "@/lib/domain/schemas";
import type { ReferenceRole } from "@/lib/domain/vocab";
import type { ServerContext } from "@/lib/server/context";
import { badRequest, notFound } from "@/lib/server/http";
import { deleteAsset } from "./assets";

/**
 * Attach an existing image (an imported original or a generation) to a Style DNA
 * reference board. The stored file is shared, not copied. Idempotent: the same
 * image on the same profile returns the existing reference, re-enabled.
 */
export async function referenceFromGeneration(
  ctx: ServerContext,
  input: { generationId: string; profileId: string; role: ReferenceRole; label?: string },
): Promise<ReferenceImage> {
  const gen = await ctx.db.table("generations").get(input.generationId);
  if (!gen) throw notFound("Image");
  if (!gen.assetId) throw badRequest("This image has no file yet.");
  const profile = await ctx.db.table("style_profiles").get(input.profileId);
  if (!profile) throw notFound("Style profile");

  const refs = ctx.db.table("reference_images");
  const existing = await refs.first({ where: { profileId: profile.id, assetId: gen.assetId } });
  if (existing) {
    if (!existing.enabled || existing.role !== input.role) {
      return refs.update(existing.id, { enabled: true, role: input.role });
    }
    return existing;
  }
  return refs.insert({
    profileId: profile.id,
    assetId: gen.assetId,
    role: input.role,
    label: input.label?.trim() || gen.title,
    notes: gen.source === "imported" ? "Original artwork" : "From a generated image",
    enabled: true,
  });
}

/** Delete a stored file only when no image and no other reference still uses it. */
export async function deleteAssetIfUnused(ctx: ServerContext, assetId: string | null | undefined) {
  if (!assetId) return;
  const [images, references] = await Promise.all([
    ctx.db.table("generations").count({ where: { assetId } }),
    ctx.db.table("reference_images").count({ where: { assetId } }),
  ]);
  if (images === 0 && references === 0) await deleteAsset(ctx, assetId);
}
