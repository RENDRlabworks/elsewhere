"use client";

import * as React from "react";
import type { Composition } from "@/lib/domain/schemas";
import { ANCHOR_POINTS, type Anchor } from "@/lib/domain/vocab";
import { nearestAnchor } from "@/lib/composition/analytics";
import { positionLanguage } from "@/lib/prompt/language";
import { clamp, cn } from "@/lib/utils";

type Props = {
  value: Composition;
  aspectRatio: string;
  onChange: (patch: Partial<Composition>) => void;
  disabled?: boolean;
  hasSubject: boolean;
  /** Placement counts across the scene's history, 5x5, for a faint heatmap. */
  heatmap?: number[][];
};

const ANCHOR_KEYS = Object.keys(ANCHOR_POINTS) as Exclude<Anchor, "custom">[];

/**
 * Miniature frame for placing the subject. Drag the marker for a custom
 * position, or click one of the nine anchors. Coordinates are normalised 0..1.
 */
export function CompositionPad({ value, aspectRatio, onChange, disabled, hasSubject, heatmap }: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [w, h] = aspectRatio.split(":").map(Number);
  const ratio = w / h;

  const setFromPointer = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const x = clamp((clientX - r.left) / r.width, 0, 1);
    const y = clamp((clientY - r.top) / r.height, 0, 1);
    const snapped = ANCHOR_KEYS.find((k) => Math.hypot(ANCHOR_POINTS[k][0] - x, ANCHOR_POINTS[k][1] - y) < 0.035);
    if (snapped) onChange({ x: ANCHOR_POINTS[snapped][0], y: ANCHOR_POINTS[snapped][1], anchor: snapped });
    else onChange({ x: round(x), y: round(y), anchor: "custom" });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!d[e.key]) return;
    e.preventDefault();
    onChange({ x: round(clamp(value.x + d[e.key][0], 0, 1)), y: round(clamp(value.y + d[e.key][1], 0, 1)), anchor: "custom" });
  };

  const maxHeat = Math.max(1, ...(heatmap?.flat() ?? [0]));
  const markerH = Math.max(3, Math.min(100, value.subjectHeight));

  return (
    <div className="space-y-2">
      <div className="flex justify-center rounded-md border border-border bg-background p-3">
        <div
          ref={ref}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label="Subject position in frame"
          aria-valuetext={hasSubject ? positionLanguage(value.x, value.y) : "No subject"}
          aria-disabled={disabled}
          onKeyDown={disabled ? undefined : onKey}
          onPointerDown={(e) => {
            if (disabled) return;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            setDragging(true);
            setFromPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => dragging && setFromPointer(e.clientX, e.clientY)}
          onPointerUp={() => setDragging(false)}
          className={cn(
            "relative touch-none overflow-hidden rounded-sm bg-surface outline-none focus-visible:ring-1 focus-visible:ring-text-secondary",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair",
          )}
          style={ratio >= 1 ? { width: "100%", aspectRatio: `${w} / ${h}` } : { height: 190, aspectRatio: `${w} / ${h}` }}
        >
          {heatmap ? (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-5 grid-rows-5">
              {heatmap.flatMap((row, ri) =>
                row.map((n, ci) => (
                  <div key={`${ri}-${ci}`} style={{ background: `rgba(237,237,239,${(n / maxHeat) * 0.12})` }} />
                )),
              )}
            </div>
          ) : null}
          {/* thirds */}
          <div className="pointer-events-none absolute inset-0">
            {[1 / 3, 2 / 3].map((p) => (
              <React.Fragment key={p}>
                <div className="absolute top-0 bottom-0 w-px bg-border" style={{ left: `${p * 100}%` }} />
                <div className="absolute right-0 left-0 h-px bg-border" style={{ top: `${p * 100}%` }} />
              </React.Fragment>
            ))}
          </div>
          {ANCHOR_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label={`Place subject ${k.replace("-", " ")}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                onChange({ x: ANCHOR_POINTS[k][0], y: ANCHOR_POINTS[k][1], anchor: k });
              }}
              className={cn(
                "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors",
                value.anchor === k ? "border-transparent" : "border-text-muted/50 hover:border-text-secondary",
              )}
              style={{ left: `${ANCHOR_POINTS[k][0] * 100}%`, top: `${ANCHOR_POINTS[k][1] * 100}%` }}
            />
          ))}
          {hasSubject ? (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%`, height: `${markerH}%`, minHeight: 6 }}
            >
              <div className="mx-auto h-full w-[3px] rounded-full bg-foreground" />
              <div className="absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rounded-full border border-background bg-foreground" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-text-muted">No subject</div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-text-muted">
        <span className="truncate">{hasSubject ? positionLanguage(value.x, value.y).replace(/^placed /, "") : "Environment only"}</span>
        <span className="shrink-0 font-mono tabular-nums">
          {value.x.toFixed(2)}, {value.y.toFixed(2)}
          {value.anchor !== "custom" ? "" : " · custom"}
        </span>
      </div>
      {heatmap && heatmap.flat().some(Boolean) ? (
        <div className="text-[11px] text-text-muted">Faint cells show where earlier images from this scene placed the subject.</div>
      ) : null}
    </div>
  );
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export { nearestAnchor };
