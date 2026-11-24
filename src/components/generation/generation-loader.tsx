"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The Defacto dot loaders (RENDRlabworks/defacto-components, vendored under
 * public/vendor/dot-loader) shown while an image is being generated. Each new
 * generation gets a random pattern, never the same as the one before it, and keeps
 * it for as long as it is loading, so the animation does not jump between polls.
 *
 * It plays the waiting motion only: the image API reports no progress, and the
 * loader never pretends to know how far along a render is.
 */

export const LOADER_PATTERNS = ["tide", "bloom", "zipper", "scatter", "stack", "dial", "halftone", "grow", "checker", "knight"] as const;
export type LoaderPattern = (typeof LOADER_PATTERNS)[number];

const SRC = "/vendor/dot-loader/dot-loader.js";
const assigned = new Map<string, LoaderPattern>();
let last: LoaderPattern | null = null;

/** A random pattern for this generation, stable for its id and different from the previous one. */
export function patternFor(id: string, rand: () => number = Math.random): LoaderPattern {
  const existing = assigned.get(id);
  if (existing) return existing;
  const pool = LOADER_PATTERNS.filter((p) => p !== last);
  const pick = pool[Math.floor(rand() * pool.length)];
  assigned.set(id, pick);
  last = pick;
  return pick;
}

function ensureScript() {
  if (typeof window === "undefined" || customElements.get("dot-loader") || document.querySelector(`script[src="${SRC}"]`)) return;
  const s = document.createElement("script");
  s.src = SRC;
  s.async = true;
  document.head.appendChild(s);
}

/** Defacto's greys, set on the element so Elsewhere's own theme tokens never leak in. */
const DEFACTO_TOKENS = {
  "--accent": "#FFFFFF",
  "--data-1": "#D6D6D6",
  "--data-2": "#B3B3B3",
  "--data-3": "#959595",
  "--data-4": "#7C7C7C",
  "--data-5": "#666666",
  "--data-5-low": "#303030",
  "--radius-xs": "2px",
} as React.CSSProperties;

/**
 * `size` is a width in pixels for a square loader, or "fill" to cover the parent box.
 * Filled loaders keep Defacto's cell size (12px cells on a 16px pitch) and add cells
 * to cover the box, so the dots never grow; boxes under 140px get the 9 by 9 grid
 * scaled to fit.
 */
export function GenerationLoader({
  id,
  size = 70,
  label = "Generating image",
  className,
}: {
  id: string;
  size?: number | "fill";
  label?: string;
  className?: string;
}) {
  const [pattern] = React.useState(() => patternFor(id));
  React.useEffect(ensureScript, []);
  const fill = size === "fill";
  return (
    <dot-loader
      pattern={pattern}
      label={label}
      data-pattern={pattern}
      fill={fill ? "" : undefined}
      className={cn("shrink-0", fill && "block size-full", className)}
      style={{ ...DEFACTO_TOKENS, ...(fill ? {} : { width: size }) }}
    />
  );
}

/** A loader covering a box (a tile, thumbnail or the canvas frame), with an optional caption. */
export function FillLoader({ id, inset = 12, children }: { id: string; inset?: number; children?: React.ReactNode }) {
  return (
    <div className="absolute inset-0 bg-surface" style={{ padding: inset }}>
      <GenerationLoader id={id} size="fill" />
      {children}
    </div>
  );
}
