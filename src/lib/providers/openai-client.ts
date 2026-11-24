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

export type OpenAIErrorInfo = {
  message: string;
  retryable: boolean;
  status?: number;
  /** OpenAI's machine-readable error code, e.g. "insufficient_quota". */
  code?: string;
  /** OpenAI request ID, useful when contacting OpenAI support. Not secret. */
  requestId?: string;
};

const BILLING_CODES = new Set(["insufficient_quota", "billing_hard_limit_reached", "billing_not_active"]);

/** Translate an OpenAI error into a specific, actionable message without leaking secrets. */
export function describeOpenAIError(err: unknown): OpenAIErrorInfo {
  if (err instanceof OpenAI.APIError) {
    const status = err.status;
    const code = err.code ?? (typeof err.type === "string" ? err.type : undefined) ?? undefined;
    const requestId = err.requestID ?? undefined;
    const raw = err.message ?? "";
    const base = { status, code, requestId };

    if (status === 401 || code === "invalid_api_key") {
      return { ...base, retryable: false, message: "The OpenAI API key was rejected. Check OPENAI_API_KEY in your deployment settings." };
    }
    if (code && BILLING_CODES.has(code)) {
      return {
        ...base,
        retryable: false,
        message: "Your OpenAI account is out of credit or has reached its billing limit. Add credit at platform.openai.com under Settings, Billing, then try again.",
      };
    }
    if (status === 429) {
      return { ...base, retryable: true, message: "OpenAI is rate limiting this account. Wait a minute and try again." };
    }
    if (status === 403) {
      return {
        ...base,
        retryable: false,
        message: /verif/i.test(raw)
          ? "Your OpenAI organization must be verified before it can use this model. Verify it at platform.openai.com under Settings, Organization."
          : "Your OpenAI organization does not have access to this model. Check Settings, Limits at platform.openai.com, or choose another model.",
      };
    }
    if (status === 404 || code === "model_not_found") {
      return { ...base, retryable: false, message: "The selected model is not available to this API key. Choose another model in Settings." };
    }
    if (code === "moderation_blocked" || code === "content_policy_violation" || /safety|moderation|content[_ ]policy/i.test(raw)) {
      return { ...base, retryable: false, message: "The request was declined by OpenAI's safety system. Adjust the scene and try again." };
    }
    if (status != null && status >= 500) {
      return { ...base, retryable: true, message: "OpenAI is having trouble right now. Try again in a moment." };
    }
    return { ...base, retryable: false, message: `OpenAI rejected the request: ${redactKeys(raw)}` };
  }
  if (err instanceof Error && err.name === "AbortError") return { message: "Cancelled", retryable: false };
  return { message: err instanceof Error ? err.message : String(err), retryable: false };
}

function redactKeys(message: string) {
  return message.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***");
}
