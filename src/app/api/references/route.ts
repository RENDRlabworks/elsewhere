import { z } from "zod";
import { REFERENCE_ROLES } from "@/lib/domain/vocab";
import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";
import { fileFromForm, saveImageAsset } from "@/lib/services/assets";

export const GET = handle(async (req: Request) => {
  const ctx = await getContext();
  const profileId = new URL(req.url).searchParams.get("profileId");
  const refs = await ctx.db.table("reference_images").list({
    where: profileId ? { profileId } : undefined,
    order: [{ field: "createdAt" }],
  });
  const assets = refs.length ? await ctx.db.table("assets").list({ where: { id: { in: refs.map((r) => r.assetId) } } }) : [];
  return json({ references: refs.map((r) => ({ ...r, asset: assets.find((a) => a.id === r.assetId) ?? null })) });
});

const fields = z.object({
  profileId: z.string().max(64).nullable(),
  role: z.enum(REFERENCE_ROLES).default("style"),
  label: z.string().max(120).default(""),
});

export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  const form = await req.formData();
  const meta = fields.parse({
    profileId: (form.get("profileId") as string) || null,
    role: (form.get("role") as string) || undefined,
    label: (form.get("label") as string) || undefined,
  });
  if (meta.profileId && !(await ctx.db.table("style_profiles").get(meta.profileId))) {
    return json({ error: { message: "Style profile not found", code: "not_found" } }, { status: 404 });
  }
  const file = await fileFromForm(form);
  const asset = await saveImageAsset(ctx, "reference", file.data, file.mimeType);
  const reference = await ctx.db.table("reference_images").insert({
    profileId: meta.profileId,
    assetId: asset.id,
    role: meta.role,
    label: meta.label || file.name.replace(/\.[^.]+$/, ""),
    notes: "",
    enabled: true,
  });
  return json({ reference: { ...reference, asset } }, { status: 201 });
});
