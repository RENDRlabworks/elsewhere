import type { BackgroundMode, ImageFormat, Quality } from "@/lib/domain/vocab";
import type { GenerationUsage } from "@/lib/domain/schemas";

export type SizeRules =
  | { mode: "fixed"; options: { width: number; height: number }[] }
  | {
      mode: "flexible";
      multiple: number;
      minPixels: number;
      maxPixels: number;
      maxEdge: number;
      /** width / height limits */
      minRatio: number;
      maxRatio: number;
      /** Pixel count above which output is marked experimental by the provider. */
      experimentalAbovePixels?: number;
    };

export type ImageCapabilities = {
  textToImage: boolean;
  /** Can condition on uploaded reference images. */
  referenceImages: boolean;
  maxReferenceImages: number;
  /** Can edit or vary a source image. */
  editing: boolean;
  sizes: SizeRules;
  qualities: Quality[];
  formats: ImageFormat[];
  transparency: boolean;
  maxImagesPerRequest: number;
  supportsInputFidelity?: boolean;
};

export type ImagePricing =
  | {
      kind: "per-token";
      /** USD per million tokens. Undefined means unknown, never guessed. */
      imageOutputPerM: number;
      imageInputPerM?: number;
      textInputPerM?: number;
    }
  | {
      kind: "per-image";
      /** USD per image by quality and "WxH". */
      table: Partial<Record<Quality, Record<string, number>>>;
    };

export type ImageModelConfig = {
  id: string;
  label: string;
  description: string;
  provider: string;
  capabilities: ImageCapabilities;
  pricing?: ImagePricing;
  recommended?: boolean;
  /** True when the model is not in the registry and conservative defaults are used. */
  unverified?: boolean;
};

export type InputImage = { data: Buffer; mimeType: string; name: string };

export type ProviderRequest = {
  model: string;
  prompt: string;
  width: number;
  height: number;
  quality: Quality;
  format: ImageFormat;
  background: BackgroundMode;
  n: number;
  /** Reference images to condition on (only sent when the model supports them). */
  references: InputImage[];
  /** Source image for variations and refinements; sent as the first input image. */
  source?: InputImage | null;
  operation: "generate" | "variation" | "refine";
  /** Opaque, non-identifying hash used for provider abuse monitoring. */
  safetyIdentifier?: string;
  /** Structured scene hints. Only the development sketch provider reads these. */
  hints?: {
    title: string;
    x: number;
    y: number;
    subjectHeight: number;
    hasSubject: boolean;
    swatches: string[];
    composition: string;
    seed: number;
  };
};

export type ProviderImage = { data: Buffer; mimeType: string };

export type ProviderResult = {
  images: ProviderImage[];
  usage?: GenerationUsage;
  revisedPrompt?: string;
  /** True for development placeholders that are not generated artwork. */
  placeholder?: boolean;
};

export interface ImageProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  /** Human-readable reason when not configured. */
  configurationHint(): string;
  models(): ImageModelConfig[];
  defaultModel(): string;
  run(req: ProviderRequest, signal?: AbortSignal): Promise<ProviderResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public retryable = false,
    public status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
