import "server-only";
import type { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { env } from "@/lib/server/env";
import { describeOpenAIError, getOpenAI } from "./openai-client";
import { ProviderError } from "./image/types";

/**
 * Structured text and vision completions for creative assistance.
 * Output is always validated against a Zod schema; free-form text is never trusted.
 */

export const DEFAULT_TEXT_MODEL = "gpt-5.5";

export function textModel(preferred?: string | null) {
  return preferred || env.openaiTextModel || DEFAULT_TEXT_MODEL;
}

export function textAssistAvailable() {
  return !!env.openaiKey;
}

export async function structuredCompletion<S extends z.ZodType>(opts: {
  schema: S;
  name: string;
  system: string;
  user: string;
  images?: { data: Buffer; mimeType: string }[];
  model?: string | null;
}): Promise<{ data: z.infer<S>; model: string; inputTokens: number; outputTokens: number }> {
  if (!textAssistAvailable()) throw new ProviderError("AI assistance requires OPENAI_API_KEY on the server.");
  const model = textModel(opts.model);
  try {
    const response = await getOpenAI().responses.parse({
      model,
      input: [
        { role: "system", content: opts.system },
        {
          role: "user",
          content: [
            { type: "input_text", text: opts.user },
            ...(opts.images ?? []).map((img) => ({
              type: "input_image" as const,
              image_url: `data:${img.mimeType};base64,${img.data.toString("base64")}`,
              detail: "low" as const,
            })),
          ],
        },
      ],
      text: { format: zodTextFormat(opts.schema, opts.name) },
    });
    const parsed = response.output_parsed;
    if (!parsed) throw new ProviderError("The assistant returned no structured result.", true);
    return {
      data: opts.schema.parse(parsed),
      model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    const d = describeOpenAIError(err);
    throw new ProviderError(d.message, d.retryable, d.status);
  }
}
