import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/server/env";

let client: OpenAI | null = null;

/** Shared server-side OpenAI client. The API key never leaves the server. */
export function getOpenAI(): OpenAI {
  if (!env.openaiKey) throw new Error("OPENAI_API_KEY is not configured");
  client ??= new OpenAI({
    apiKey: env.openaiKey,
    baseURL: env.openaiBaseUrl,
    organization: env.openaiOrg,
    maxRetries: 2,
    timeout: 280_000,
  });
  return client;
}

export function describeOpenAIError(err: unknown): { message: string; retryable: boolean; status?: number } {
  if (err instanceof OpenAI.APIError) {
    const status = err.status;
    const retryable = status === 429 || (status != null && status >= 500);
    let message = err.message;
    if (status === 401) message = "The OpenAI API key was rejected. Check OPENAI_API_KEY.";
    else if (status === 429) message = "OpenAI rate limit or quota reached. Wait a moment, or check your billing limits.";
    else if (status === 400 && /safety|moderation|content_policy/i.test(err.message))
      message = "The request was declined by the provider's safety system. Adjust the scene and try again.";
    else if (status === 404) message = "The selected model is not available to this API key.";
    return { message, retryable, status };
  }
  if (err instanceof Error && err.name === "AbortError") return { message: "Cancelled", retryable: false };
  return { message: err instanceof Error ? err.message : String(err), retryable: false };
}
