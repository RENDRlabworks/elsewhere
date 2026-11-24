import "server-only";
import { devSketchProvider } from "./dev-sketch";
import { unverifiedModel } from "./models";
import { openaiImageProvider } from "./openai";
import type { ImageModelConfig, ImageProvider } from "./types";

/** All image providers known to Elsewhere. Add new providers here. */
export const IMAGE_PROVIDERS: ImageProvider[] = [openaiImageProvider, devSketchProvider];

export function getImageProvider(id: string): ImageProvider | null {
  return IMAGE_PROVIDERS.find((p) => p.id === id) ?? null;
}

/** Choose the provider for a request: the requested one if configured, otherwise the first configured provider. */
export function resolveProvider(requested: string | null | undefined): ImageProvider | null {
  const want = requested ? getImageProvider(requested) : null;
  if (want?.isConfigured()) return want;
  return IMAGE_PROVIDERS.find((p) => p.isConfigured()) ?? null;
}

export function resolveModel(provider: ImageProvider, requested: string | null | undefined): ImageModelConfig {
  const models = provider.models();
  if (requested) {
    const found = models.find((m) => m.id === requested);
    if (found) return found;
    if (provider.id === "openai") return unverifiedModel(requested);
  }
  return models.find((m) => m.id === provider.defaultModel()) ?? models[0];
}

export function providerCatalog() {
  return IMAGE_PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    configured: p.isConfigured(),
    hint: p.configurationHint(),
    defaultModel: p.defaultModel(),
    models: p.models(),
  }));
}
export type ProviderCatalog = ReturnType<typeof providerCatalog>;
