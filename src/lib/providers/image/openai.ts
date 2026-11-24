import "server-only";
import { toFile } from "openai";
import type {
  ImageEditParamsNonStreaming,
  ImageEditParamsStreaming,
  ImageEditStreamEvent,
  ImageGenerateParamsNonStreaming,
  ImageGenerateParamsStreaming,
  ImageGenStreamEvent,
} from "openai/resources/images";
import { env } from "@/lib/server/env";
import { describeOpenAIError, getOpenAI } from "../openai-client";
import { OPENAI_IMAGE_MODELS, unverifiedModel } from "./models";
import { ProviderError, type ImageProvider, type ProviderHooks, type ProviderRequest, type ProviderResult } from "./types";

const MIME: Record<string, string> = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg" };

/** Partial images stream for single-image requests in raster formats. */
const canStream = (req: Pick<ProviderRequest, "n" | "format">) => req.n === 1 && ["png", "webp", "jpeg"].includes(req.format);

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

  streamsPartials: canStream,

  async run(req: ProviderRequest, signal?: AbortSignal, hooks?: ProviderHooks): Promise<ProviderResult> {
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
    const partials = hooks?.onPartial && canStream(req) ? Math.max(0, Math.min(3, req.partialImages ?? 0)) : 0;
    try {
      if (partials) return await streamRun(req, inputs, common, partials, hooks!, signal);
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
      throw new ProviderError(d.message, d.retryable, d.status, d.code, d.requestId);
    }
  },
};

/**
 * Streamed request: partial images are handed to hooks.onPartial as they arrive, and
 * the completed event carries the final image and usage. OpenAI may finish before
 * sending every partial image it was asked for.
 */
async function streamRun(
  req: ProviderRequest,
  inputs: { data: Buffer; name: string; mimeType: string }[],
  common: Record<string, unknown>,
  partials: number,
  hooks: ProviderHooks,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const client = getOpenAI();
  let stream: AsyncIterable<ImageGenStreamEvent | ImageEditStreamEvent>;
  if (inputs.length) {
    const files = await Promise.all(inputs.map((i) => toFile(i.data, i.name, { type: i.mimeType })));
    const model = OPENAI_IMAGE_MODELS.find((m) => m.id === req.model);
    const params = {
      ...common,
      image: files,
      stream: true,
      partial_images: partials,
      ...(model?.capabilities.supportsInputFidelity && req.source ? { input_fidelity: "high" as const } : {}),
    } as ImageEditParamsStreaming;
    stream = await client.images.edit(params, { signal });
  } else {
    stream = await client.images.generate({ ...common, stream: true, partial_images: partials } as ImageGenerateParamsStreaming, { signal });
  }
  let final: Extract<ImageGenStreamEvent | ImageEditStreamEvent, { type: "image_generation.completed" | "image_edit.completed" }> | null = null;
  for await (const ev of stream) {
    if (ev.type === "image_generation.partial_image" || ev.type === "image_edit.partial_image") {
      await hooks.onPartial?.({ index: ev.partial_image_index, data: Buffer.from(ev.b64_json, "base64"), mimeType: MIME[ev.output_format] ?? "image/png" });
    } else if (ev.type === "image_generation.completed" || ev.type === "image_edit.completed") {
      final = ev;
    }
  }
  if (!final?.b64_json) throw new ProviderError("The provider returned no images.", true);
  const u = final.usage;
  return {
    images: [{ data: Buffer.from(final.b64_json, "base64"), mimeType: MIME[final.output_format ?? req.format] ?? "image/png" }],
    usage: u
      ? {
          inputTokens: u.input_tokens,
          outputTokens: u.output_tokens,
          imageInputTokens: u.input_tokens_details?.image_tokens,
          textInputTokens: u.input_tokens_details?.text_tokens,
          imageOutputTokens: u.output_tokens,
        }
      : undefined,
  };
}
