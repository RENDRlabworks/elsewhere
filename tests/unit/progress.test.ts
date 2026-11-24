import { describe, expect, it } from "vitest";
import type { GenerationProgress } from "@/lib/domain/schemas";
import { estimatePercent, PROGRESS_CAP, previewBlur } from "@/lib/generation/progress";

const T0 = Date.parse("2026-11-24T12:00:00Z");
const progress = (over: Partial<GenerationProgress> = {}): GenerationProgress => ({
  startedAt: new Date(T0).toISOString(),
  expectedMs: 20_000,
  samples: 4,
  partialsRequested: 2,
  partialsReceived: 0,
  preview: null,
  ...over,
});
const at = (ms: number) => T0 + ms;

describe("estimated generation progress", () => {
  it("waits while queued or without anything to go on", () => {
    expect(estimatePercent({ status: "queued", progress: null }, at(5000))).toBeNull();
    expect(estimatePercent({ status: "generating", progress: progress({ expectedMs: null }) }, at(5000))).toBeNull();
    expect(estimatePercent({ status: "failed", progress: progress() }, at(5000))).toBeNull();
  });

  it("follows elapsed time against the expected duration and never claims to be done early", () => {
    const g = { status: "generating" as const, progress: progress() };
    const series = [0, 2000, 5000, 10_000, 20_000, 40_000, 400_000].map((ms) => estimatePercent(g, at(ms))!);
    for (let i = 1; i < series.length; i++) expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
    expect(series[0]).toBe(0);
    expect(series[4]).toBeGreaterThan(75);
    expect(series[4]).toBeLessThan(90);
    expect(series.at(-1)).toBe(PROGRESS_CAP);
  });

  it("lifts the estimate to a checkpoint as partial images arrive", () => {
    const early = at(1000);
    expect(estimatePercent({ status: "generating", progress: progress({ partialsReceived: 1 }) }, early)).toBe(50);
    expect(estimatePercent({ status: "generating", progress: progress({ partialsReceived: 2 }) }, early)).toBe(80);
    expect(estimatePercent({ status: "generating", progress: progress({ expectedMs: null, partialsRequested: 3, partialsReceived: 1 }) }, early)).toBe(40);
  });

  it("is nearly done while the file is saved, and complete only when it is", () => {
    expect(estimatePercent({ status: "processing", progress: progress() }, at(100))).toBe(92);
    expect(estimatePercent({ status: "processing", progress: null }, at(100))).toBe(92);
    expect(estimatePercent({ status: "completed", progress: null }, at(100))).toBe(100);
  });

  it("blurs rougher previews more", () => {
    expect(previewBlur(progress({ partialsReceived: 1 }))).toBeGreaterThan(previewBlur(progress({ partialsReceived: 2 })));
  });
});
