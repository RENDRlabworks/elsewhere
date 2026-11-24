import { styleProfileUpdateSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { getStyleProfile, updateStyleProfile } from "@/lib/services/styles";

type P = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const profile = await getStyleProfile(ctx, id);
  const [versions, references, usage] = await Promise.all([
    ctx.db.table("style_profile_versions").list({ where: { profileId: id }, order: [{ field: "version", ascending: false }], limit: 50 }),
    ctx.db.table("reference_images").list({ where: { profileId: id }, order: [{ field: "createdAt" }] }),
    ctx.db.table("generations").count({ where: { styleProfileId: id } }),
  ]);
  return json({ profile, versions, references, generationCount: usage });
});

export const PATCH = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await getContext();
  const body = await parseJson(req, styleProfileUpdateSchema);
  return json({ profile: await updateStyleProfile(ctx, id, body) });
});
