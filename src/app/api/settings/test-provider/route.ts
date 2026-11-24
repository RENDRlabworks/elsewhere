import { getContext } from "@/lib/server/context";
import { env } from "@/lib/server/env";
import { handle, json, redact } from "@/lib/server/http";
import { getOpenAI } from "@/lib/providers/openai-client";

/** Verify the server's OpenAI credentials without generating anything billable. */
export const POST = handle(async () => {
  await getContext();
  if (!env.openaiKey) return json({ ok: false, message: "OPENAI_API_KEY is not set on the server." });
  try {
    const page = await getOpenAI().models.list();
    const ids = page.data.map((m) => m.id);
    const imageModels = ids.filter((id) => id.startsWith("gpt-image") || id.startsWith("chatgpt-image"));
    return json({ ok: true, message: `Connected. ${imageModels.length} image model${imageModels.length === 1 ? "" : "s"} available.`, imageModels });
  } catch (err) {
    return json({ ok: false, message: redact(err instanceof Error ? err.message : String(err)) });
  }
});
