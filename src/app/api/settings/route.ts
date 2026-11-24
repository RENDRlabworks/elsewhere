import { preferencesPatchSchema, preferencesSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { env, publicRuntimeInfo } from "@/lib/server/env";
import { handle, HttpError, json, parseJson } from "@/lib/server/http";
import { storageSummary, usageSummary } from "@/lib/services/archive";

export const GET = handle(async () => {
  const ctx = await getContext();
  const prefs = await ctx.db.table("user_preferences").first({});
  if (!prefs) throw new HttpError(409, "Workspace is not initialised", "not_bootstrapped");
  const [usage, storage] = await Promise.all([usageSummary(ctx), storageSummary(ctx)]);
  return json({
    preferences: prefs.data,
    usage,
    storage,
    runtime: publicRuntimeInfo(),
    hardDailyImageCap: env.hardDailyImageCap,
  });
});

export const PATCH = handle(async (req: Request) => {
  const ctx = await getContext();
  const patch = await parseJson(req, preferencesPatchSchema);
  const row = await ctx.db.table("user_preferences").first({});
  if (!row) throw new HttpError(409, "Workspace is not initialised", "not_bootstrapped");
  const cur = row.data;
  const data = preferencesSchema.parse({
    ...cur,
    ...patch,
    defaults: { ...cur.defaults, ...patch.defaults },
    limits: { ...cur.limits, ...patch.limits },
    ui: { ...cur.ui, ...patch.ui },
    autosave: { ...cur.autosave, ...patch.autosave },
    shortcuts: patch.shortcuts ?? cur.shortcuts,
  });
  const updated = await ctx.db.table("user_preferences").update(row.id, { data });
  return json({ preferences: updated.data });
});
