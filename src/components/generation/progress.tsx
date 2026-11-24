"use client";

import * as React from "react";
import type { Generation } from "@/lib/domain/schemas";
import { estimatePercent, previewBlur } from "@/lib/generation/progress";
import { STATUS_LABEL } from "./actions";
import { FillLoader } from "./generation-loader";

/* A shared clock that ticks five times a second while anything is listening. */
const clock = (() => {
  let now = Date.now();
  const subs = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    subscribe(fn: () => void) {
      subs.add(fn);
      timer ??= setInterval(() => {
        now = Date.now();
        subs.forEach((s) => s());
      }, 200);
      return () => {
        subs.delete(fn);
        if (!subs.size && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    get: () => now,
  };
})();

const noop = () => () => {};

/** The estimated percentage for a generation, ticking while it is in progress. */
export function useGenerationPercent(g: Pick<Generation, "status" | "progress">): number | null {
  const live = g.status === "generating" || g.status === "processing";
  const now = React.useSyncExternalStore(live ? clock.subscribe : noop, clock.get, () => 0);
  return estimatePercent(g, now);
}

/*
 * When an image finishes while it is on screen, the loader holds at 100% for a moment
 * so its finishing pass plays before the image replaces it.
 */
const HOLD_MS = 1100;
const holds = (() => {
  const seenActive = new Set<string>();
  const until = new Set<string>();
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((s) => s());
  return {
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    observe(id: string, status: Generation["status"]) {
      if (status === "queued" || status === "generating" || status === "processing") seenActive.add(id);
      else if (status === "completed" && seenActive.delete(id)) {
        until.add(id);
        emit();
        setTimeout(() => {
          until.delete(id);
          emit();
        }, HOLD_MS);
      }
    },
    holding: (id: string) => until.has(id),
  };
})();

export function useCompletionHold(g: Pick<Generation, "id" | "status">): boolean {
  React.useEffect(() => holds.observe(g.id, g.status), [g.id, g.status]);
  return React.useSyncExternalStore(holds.subscribe, () => holds.holding(g.id), () => false);
}

/**
 * The loader for a generation that is running (or has just finished), covering its box,
 * with the latest partial image blurred behind the dots and a caption with the estimate.
 */
export function GenerationProgressFill({
  g,
  inset,
  caption,
}: {
  g: Generation;
  inset?: number;
  caption?: (state: { percent: number | null; label: string }) => React.ReactNode;
}) {
  const percent = useGenerationPercent(g);
  const p = g.progress ?? null;
  const label = g.status === "completed" ? "Done" : STATUS_LABEL[g.status];
  return (
    <FillLoader
      id={g.id}
      inset={inset}
      value={percent}
      backdrop={
        p?.preview && g.status !== "completed" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.preview}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full scale-110 object-cover opacity-45 transition-[filter] duration-700"
            style={{ filter: `blur(${previewBlur(p)}px)` }}
          />
        ) : null
      }
    >
      {caption?.({ percent, label })}
    </FillLoader>
  );
}
