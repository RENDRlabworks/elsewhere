import "server-only";
import sharp from "sharp";
import { devProviderEnabled } from "@/lib/server/env";
import { luminance } from "@/lib/palette/color";
import { createRng } from "@/lib/explore/engine";
import type { ImageModelConfig, ImageProvider, ProviderHooks, ProviderRequest, ProviderResult } from "./types";

/**
 * Development sketch provider.
 * Renders a clearly labelled composition study (palette, horizon, subject
 * position and scale) so the full generation workflow can be exercised without
 * provider credentials. It never pretends to be artwork: every output carries a
 * visible "development placeholder" label and is flagged in the database.
 */

const MODEL: ImageModelConfig = {
  id: "composition-sketch",
  label: "Composition sketch (development)",
  description: "Labelled composition studies for testing workflows without an API key. Not generated artwork.",
  provider: "dev",
  capabilities: {
    textToImage: true,
    referenceImages: false,
    maxReferenceImages: 0,
    editing: true,
    sizes: { mode: "flexible", multiple: 16, minPixels: 65_536, maxPixels: 4_194_304, maxEdge: 2048, minRatio: 1 / 3, maxRatio: 3 },
    qualities: ["auto", "low", "medium", "high"],
    formats: ["png", "webp", "jpeg"],
    transparency: false,
    maxImagesPerRequest: 4,
  },
};

function esc(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function sketchSvg(req: ProviderRequest, index: number): string {
  const w = req.width;
  const h = req.height;
  const hints = req.hints ?? {
    title: "Untitled",
    x: 0.5,
    y: 0.7,
    subjectHeight: 4,
    hasSubject: true,
    swatches: ["#0b0c0e", "#1d2321", "#3c4a42", "#8a8f86", "#cfc6b0"],
    composition: "",
    seed: 1,
  };
  const rand = createRng(hints.seed + index * 7919);
  const sw = [...(hints.swatches.length ? hints.swatches : ["#0b0c0e", "#3c4a42", "#cfc6b0"])].sort((a, b) => luminance(a) - luminance(b));
  const dark = sw[0];
  const mid = sw[Math.floor(sw.length / 2)];
  const light = sw[sw.length - 1];
  const jitter = (v: number, amt: number) => Math.min(0.97, Math.max(0.03, v + (rand() - 0.5) * amt));
  const sx = jitter(hints.x, index ? 0.08 : 0) * w;
  const sy = jitter(hints.y, index ? 0.06 : 0) * h;
  const sh = Math.max(4, (hints.subjectHeight / 100) * h);
  const horizon = (0.55 + (rand() - 0.5) * 0.2) * h;
  const massX = (hints.x > 0.5 ? 0.3 : 0.7) * w;
  const massR = Math.min(w, h) * (0.22 + rand() * 0.12);
  const fs = Math.max(10, Math.round(Math.min(w, h) / 64));
  const pad = fs * 2;
  const lines = [
    "DEVELOPMENT PLACEHOLDER · NOT A GENERATED IMAGE",
    hints.title.toUpperCase(),
    `${hints.composition || "composition study"} · subject ${hints.subjectHeight}% at (${hints.x.toFixed(2)}, ${hints.y.toFixed(2)})${index ? ` · variation ${index + 1}` : ""}`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${dark}"/>
      <stop offset="0.6" stop-color="${mid}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="mass" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${light}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${light}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="${dark}"/>
  <rect width="100%" height="100%" fill="url(#sky)"/>
  <circle cx="${massX}" cy="${horizon - massR * 0.4}" r="${massR}" fill="url(#mass)"/>
  <circle cx="${massX}" cy="${horizon - massR * 0.4}" r="${massR * 0.62}" fill="none" stroke="${light}" stroke-opacity="0.18"/>
  <rect x="0" y="${horizon}" width="${w}" height="${h - horizon}" fill="${dark}" fill-opacity="0.75"/>
  <line x1="0" y1="${horizon}" x2="${w}" y2="${horizon}" stroke="${light}" stroke-opacity="0.25"/>
  <g stroke="#ffffff" stroke-opacity="0.06">
    <line x1="${w / 3}" y1="0" x2="${w / 3}" y2="${h}"/><line x1="${(2 * w) / 3}" y1="0" x2="${(2 * w) / 3}" y2="${h}"/>
    <line x1="0" y1="${h / 3}" x2="${w}" y2="${h / 3}"/><line x1="0" y1="${(2 * h) / 3}" x2="${w}" y2="${(2 * h) / 3}"/>
  </g>
  ${
    hints.hasSubject
      ? `<rect x="${sx - sh * 0.18}" y="${sy - sh}" width="${sh * 0.36}" height="${sh}" rx="${sh * 0.18}" fill="${light}" fill-opacity="0.9"/>
  <circle cx="${sx}" cy="${sy - sh / 2}" r="${Math.max(sh, 10) * 1.6}" fill="none" stroke="${light}" stroke-opacity="0.35" stroke-dasharray="3 4"/>`
      : ""
  }
  <g font-family="ui-monospace, Menlo, monospace" font-size="${fs}" fill="#ededef" fill-opacity="0.85">
    ${lines.map((l, i) => `<text x="${pad}" y="${h - pad - (lines.length - 1 - i) * fs * 1.6}">${esc(l)}</text>`).join("\n    ")}
  </g>
  <g>${sw.map((c, i) => `<rect x="${w - pad - (sw.length - i) * fs * 1.8}" y="${pad}" width="${fs * 1.5}" height="${fs * 1.5}" fill="${c}" stroke="#ffffff" stroke-opacity="0.2"/>`).join("")}</g>
</svg>`;
}

export const devSketchProvider: ImageProvider = {
  id: "dev",
  label: "Development sketch",
  isConfigured: () => devProviderEnabled(),
  configurationHint: () => "Enabled automatically in local mode, or with ELSEWHERE_DEV_PROVIDER=1.",
  models: () => [MODEL],
  defaultModel: () => MODEL.id,
  streamsPartials: (req) => req.n === 1,
  async run(req: ProviderRequest, signal?: AbortSignal, hooks?: ProviderHooks): Promise<ProviderResult> {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Partial images, like a streamed provider: progressively sharper low-resolution sketches.
    const partials = hooks?.onPartial && req.n === 1 ? Math.max(0, Math.min(3, req.partialImages ?? 0)) : 0;
    if (partials) {
      const svg = Buffer.from(sketchSvg(req, 0));
      for (let i = 0; i < partials; i++) {
        await wait(450);
        if (signal?.aborted) throw new Error("Cancelled");
        const data = await sharp(svg).resize(384, 384, { fit: "inside" }).blur(18 - i * 6).png().toBuffer();
        await hooks!.onPartial!({ index: i, data, mimeType: "image/png" });
      }
    }
    const images = [];
    for (let i = 0; i < req.n; i++) {
      const svg = sketchSvg(req, i);
      let img = sharp(Buffer.from(svg));
      img = req.format === "jpeg" ? img.jpeg({ quality: 88 }) : req.format === "webp" ? img.webp({ quality: 90 }) : img.png();
      images.push({ data: await img.toBuffer(), mimeType: `image/${req.format === "jpeg" ? "jpeg" : req.format}` });
    }
    // A short, honest delay so lifecycle states are observable during development.
    await wait(partials ? 300 : 600);
    return { images, placeholder: true };
  },
};
