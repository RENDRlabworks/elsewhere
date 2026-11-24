import "server-only";
import { toFile } from "openai";
import type { ImageEditParamsNonStreaming, ImageGenerateParamsNonStreaming } from "openai/resources/images";
import { env } from "@/lib/server/env";
import { describeOpenAIError, getOpenAI } from "../openai-client";
import { OPENAI_IMAGE_MODELS, unverifiedModel } from "./models";
import { ProviderError, type ImageProvider, type ProviderRequest, type ProviderResult } from "./types";

const MIME: Record<string, string> = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg" };

export const openaiImageProvider: ImageProvider = {
  id: "openai",
  label: "OpenAI",
  isConfigured: () => !!env.openaiKey,
  configurationHint: () => "Set OPENAI_API_KEY on the server to enable live generation.",
  models() {
    const configured = env.openaiImageModel;
    if (configured && !OPENAI_IMAGE_MODELS.some((m) => m.id === configured)) {
      return [...OPENAI_IMAGE_MODELS, unverifiedModel(configured)];
    }
    return OPENAI_IMAGE_MODELS;
  },
  defaultModel: () => env.openaiImageModel ?? OPENAI_IMAGE_MODELS.find((m) => m.recommended)!.id,

  async run(req: ProviderRequest, signal?: AbortSignal): Promise<ProviderResult> {
    const client = getOpenAI();
    const size = `${req.width}x${req.height}`;
    const inputs = [...(req.source ? [req.source] : []), ...req.references];
    const common = {
      model: req.model,
      prompt: req.prompt,
      n: req.n,
      size,
      quality: req.quality,
      output_format: req.format,
      ...(req.background !== "auto" ? { background: req.background } : {}),
      ...(req.safetyIdentifier ? { safety_identifier: req.safetyIdentifier } : {}),
    };
    try {
      let response;
      if (inputs.length) {
        const files = await Promise.all(inputs.map((i) => toFile(i.data, i.name, { type: i.mimeType })));
        const model = OPENAI_IMAGE_MODELS.find((m) => m.id === req.model);
        const params: ImageEditParamsNonStreaming = {
          ...common,
          image: files,
          ...(model?.capabilities.supportsInputFidelity && req.source ? { input_fidelity: "high" as const } : {}),
        } as ImageEditParamsNonStreaming;
        response = await client.images.edit(params, { signal });
      } else {
        response = await client.images.generate(common as ImageGenerateParamsNonStreaming, { signal });
      }
      const images = (response.data ?? [])
        .filter((d) => d.b64_json)
        .map((d) => ({ data: Buffer.from(d.b64_json!, "base64"), mimeType: MIME[response.output_format ?? req.format] ?? "image/png" }));
      if (!images.length) throw new ProviderError("The provider returned no images.", true);
      const u = response.usage;
      return {
        images,
        revisedPrompt: response.data?.[0]?.revised_prompt ?? undefined,
        usage: u
          ? {
              inputTokens: u.input_tokens,
              outputTokens: u.output_tokens,
              imageInputTokens: u.input_tokens_details?.image_tokens,
              textInputTokens: u.input_tokens_details?.text_tokens,
              imageOutputTokens: u.output_tokens_details?.image_tokens ?? u.output_tokens,
            }
          : undefined,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const d = describeOpenAIError(err);
      throw new ProviderError(d.message, d.retryable, d.status);
    }
  },
};
