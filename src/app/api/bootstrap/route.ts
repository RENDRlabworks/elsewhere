import { getContext } from "@/lib/server/context";
import { publicRuntimeInfo } from "@/lib/server/env";
import { handle, json } from "@/lib/server/http";
import { providerCatalog } from "@/lib/providers/image/registry";
import { textAssistAvailable, textModel } from "@/lib/providers/text";
import { ensureBootstrap } from "@/lib/services/bootstrap";

export const GET = handle(async () => {
  const ctx = await getContext();
  const prefs = await ensureBootstrap(ctx);
  const profiles = await ctx.db.table("style_profiles").list({ order: [{ field: "createdAt" }] });
  return json({
    user: { id: ctx.userId, email: ctx.email, mode: ctx.mode },
    runtime: publicRuntimeInfo(),
    preferences: prefs.data,
    profiles,
    providers: providerCatalog(),
    textAssist: { available: textAssistAvailable(), model: textModel(prefs.data.defaults.textModel) },
  });
});
