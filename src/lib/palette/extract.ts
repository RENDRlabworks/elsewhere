import { rgbToHex, rgbToOklab, oklabDistance, type RGB } from "./color";

/**
 * Extract dominant colours from raw RGBA pixel data using k-means in OKLab space.
 * Deterministic: centroids are seeded by a luminance-sorted spread of samples.
 */
export function extractDominantColors(rgba: Uint8ClampedArray | Uint8Array, count = 5, channels = 4): string[] {
  const samples: RGB[] = [];
  const total = Math.floor(rgba.length / channels);
  const step = Math.max(1, Math.floor(total / 6000));
  for (let i = 0; i < total; i += step) {
    const o = i * channels;
    if (channels === 4 && rgba[o + 3] < 128) continue;
    samples.push({ r: rgba[o], g: rgba[o + 1], b: rgba[o + 2] });
  }
  if (!samples.length) return [];
  const labs = samples.map(rgbToOklab);
  const order = labs.map((l, i) => [l.L, i] as const).sort((a, b) => a[0] - b[0]);
  const k = Math.min(count, samples.length);
  let centroids = Array.from({ length: k }, (_, i) => labs[order[Math.floor(((i + 0.5) / k) * order.length)][1]]);
  let assignments = new Array<number>(labs.length).fill(0);

  for (let iter = 0; iter < 12; iter++) {
    assignments = labs.map((l) => {
      let best = 0;
      let bestD = Infinity;
      centroids.forEach((c, ci) => {
        const d = oklabDistance(l, c);
        if (d < bestD) {
          bestD = d;
          best = ci;
        }
      });
      return best;
    });
    centroids = centroids.map((c, ci) => {
      const members = labs.filter((_, i) => assignments[i] === ci);
      if (!members.length) return c;
      return {
        L: members.reduce((a, m) => a + m.L, 0) / members.length,
        a: members.reduce((a, m) => a + m.a, 0) / members.length,
        b: members.reduce((a, m) => a + m.b, 0) / members.length,
      };
    });
  }

  const clusters = centroids.map((_, ci) => {
    const idx = assignments.map((a, i) => (a === ci ? i : -1)).filter((i) => i >= 0);
    const avg = idx.reduce(
      (acc, i) => ({ r: acc.r + samples[i].r, g: acc.g + samples[i].g, b: acc.b + samples[i].b }),
      { r: 0, g: 0, b: 0 },
    );
    const n = Math.max(1, idx.length);
    return { hex: rgbToHex({ r: avg.r / n, g: avg.g / n, b: avg.b / n }), size: idx.length, L: centroids[ci].L };
  });
  return clusters
    .filter((c) => c.size > 0)
    .sort((a, b) => a.L - b.L)
    .map((c) => c.hex);
}
