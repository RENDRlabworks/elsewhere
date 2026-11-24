import { describe, expect, it } from "vitest";
import OpenAI from "openai";
import { describeOpenAIError } from "@/lib/providers/openai-client";

function apiError(status: number, body: { code?: string; type?: string; message: string }) {
  return new OpenAI.APIError(status, body, undefined, new Headers({ "x-request-id": "req_test_123" }));
}

describe("describeOpenAIError", () => {
  it("tells an out-of-credit account apart from rate limiting", () => {
    const quota = describeOpenAIError(apiError(429, { code: "insufficient_quota", type: "insufficient_quota", message: "You exceeded your current quota" }));
    expect(quota.message).toMatch(/out of credit/);
    expect(quota.retryable).toBe(false);
    expect(quota.code).toBe("insufficient_quota");
    expect(quota.requestId).toBe("req_test_123");

    const limited = describeOpenAIError(apiError(429, { code: "rate_limit_exceeded", message: "Rate limit reached" }));
    expect(limited.message).toMatch(/rate limiting/);
    expect(limited.retryable).toBe(true);
  });

  it("explains rejected keys, missing access, unverified organizations and unknown models", () => {
    expect(describeOpenAIError(apiError(401, { code: "invalid_api_key", message: "Incorrect API key" })).message).toMatch(/key was rejected/);
    expect(describeOpenAIError(apiError(403, { message: "Your organization must be verified to use this model" })).message).toMatch(/must be verified/);
    expect(describeOpenAIError(apiError(403, { message: "Forbidden" })).message).toMatch(/does not have access/);
    expect(describeOpenAIError(apiError(404, { code: "model_not_found", message: "The model does not exist" })).message).toMatch(/not available/);
  });

  it("recognises safety refusals and provider outages", () => {
    expect(describeOpenAIError(apiError(400, { code: "moderation_blocked", message: "Request blocked" })).message).toMatch(/safety system/);
    const outage = describeOpenAIError(apiError(503, { message: "Service unavailable" }));
    expect(outage.message).toMatch(/having trouble/);
    expect(outage.retryable).toBe(true);
  });

  it("passes other errors through without leaking keys", () => {
    const d = describeOpenAIError(apiError(400, { message: "Invalid size for key sk-abcdefghijklmnop" }));
    expect(d.message).toMatch(/^OpenAI rejected the request/);
    expect(d.message).not.toMatch(/abcdefghijklmnop/);
  });
});
