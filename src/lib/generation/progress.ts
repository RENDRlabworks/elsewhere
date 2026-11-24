import type { Generation } from "@/lib/domain/schemas";

/**
 * An estimated percentage for a generation in progress. The image API reports no
 * percentage, so this is built from two honest signals:
 *
 * - time: elapsed time against the median duration of this user's recent comparable
 *   runs (`progress.expectedMs`), eased so it slows as it approaches the cap;
 * - checkpoints: each partial image that has actually arrived lifts the estimate to a
 *   fixed floor (with 2 requested, the first lifts it to 50% and the second to 80%).
 *
 * It never reaches 100 until the image is really done, and returns null while there is
 * nothing to base an estimate on (queued, or no history and no partial image yet), when
 * the loader plays its waiting motion instead. For stable inputs it only ever rises.
 */

export const PROGRESS_CAP = 95;
const PROCESSING_FLOOR = 92;

export function estimatePercent(g: Pick<Generation, "status" | "progress">, now: number): number | null {
  if (g.status === "completed") return 100;
  if (g.status !== "generating" && g.status !== "processing") return null;
  const p = g.progress;
  let pct: number | null = null;
  if (p?.expectedMs) {
    const elapsed = Math.max(0, now - Date.parse(p.startedAt));
    pct = PROGRESS_CAP * (1 - Math.exp((-2.4 * elapsed) / p.expectedMs));
  }
  if (p && p.partialsRequested > 0 && p.partialsReceived > 0) {
    const floor = 20 + (60 * Math.min(p.partialsReceived, p.partialsRequested)) / p.partialsRequested;
    pct = Math.max(pct ?? 0, floor);
  }
  // Saving the finished file: the image exists, only storage remains.
  if (g.status === "processing") pct = Math.max(pct ?? 0, PROCESSING_FLOOR);
  return pct == null ? null : Math.min(PROGRESS_CAP, Math.floor(pct));
}

/** How blurred a partial preview is drawn: rougher partials are blurred more. */
export function previewBlur(p: NonNullable<Generation["progress"]>): number {
  if (!p.partialsRequested) return 10;
  const left = Math.max(0, p.partialsRequested - p.partialsReceived);
  return 4 + left * 6;
}
