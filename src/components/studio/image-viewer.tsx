"use client";

import * as React from "react";
import { clamp, cn } from "@/lib/utils";

export type ZoomState = { mode: "fit" } | { mode: "scale"; scale: number };

export const CANVAS_BACKGROUNDS: Record<string, { label: string; className: string }> = {
  app: { label: "App", className: "bg-background" },
  black: { label: "Black", className: "bg-black" },
  gray: { label: "Gray", className: "bg-[#3a3a3e]" },
  white: { label: "White", className: "bg-[#f2f2f0]" },
  checker: { label: "Checker", className: "checkerboard bg-[#121214]" },
};

function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * Zoomable, pannable image. Wheel zooms around the cursor, drag pans when the
 * image exceeds the viewport. A blurred thumbnail shows while the original loads.
 */
export function ImageViewer({
  src,
  placeholder,
  width,
  height,
  zoom,
  onZoomChange,
  padding = 32,
  className,
  alt,
}: {
  src: string;
  placeholder?: string | null;
  width: number;
  height: number;
  zoom: ZoomState;
  onZoomChange: (z: ZoomState, effectiveScale: number) => void;
  padding?: number;
  className?: string;
  alt: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { w: cw, h: ch } = useSize(ref);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = React.useState(false);
  const drag = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const fit = cw && ch ? Math.min((cw - padding * 2) / width, (ch - padding * 2) / height, 1) : 1;
  const scale = zoom.mode === "fit" ? fit : zoom.scale;

  React.useEffect(() => setLoaded(false), [src]);
  React.useEffect(() => {
    if (zoom.mode === "fit") setOffset({ x: 0, y: 0 });
  }, [zoom.mode, src]);
  React.useEffect(() => {
    onZoomChange(zoom, scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  const bound = React.useCallback(
    (o: { x: number; y: number }, s = scale) => {
      const mx = Math.max(0, (width * s - cw) / 2 + padding);
      const my = Math.max(0, (height * s - ch) / 2 + padding);
      return { x: clamp(o.x, -mx, mx), y: clamp(o.y, -my, my) };
    },
    [scale, width, height, cw, ch, padding],
  );

  const onWheel = (e: React.WheelEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    const next = clamp(scale * factor, Math.min(fit, 0.05), 8);
    const px = e.clientX - r.left - cw / 2 - offset.x;
    const py = e.clientY - r.top - ch / 2 - offset.y;
    const k = next / scale;
    setOffset(bound({ x: offset.x - px * (k - 1), y: offset.y - py * (k - 1) }, next));
    onZoomChange({ mode: "scale", scale: next }, next);
  };

  const pannable = width * scale > cw - padding * 2 || height * scale > ch - padding * 2;

  return (
    <div
      ref={ref}
      className={cn("relative h-full w-full touch-none overflow-hidden select-none", pannable ? "cursor-grab active:cursor-grabbing" : "", className)}
      onWheel={onWheel}
      onPointerDown={(e) => {
        if (!pannable) return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        setOffset(bound({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y }));
      }}
      onPointerUp={() => (drag.current = null)}
      onDoubleClick={() => onZoomChange(zoom.mode === "fit" ? { mode: "scale", scale: 1 } : { mode: "fit" }, zoom.mode === "fit" ? 1 : fit)}
    >
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: width * scale,
          height: height * scale,
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
        }}
      >
        {placeholder && !loaded ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={placeholder} alt="" aria-hidden className="absolute inset-0 size-full object-contain blur-[2px]" draggable={false} />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={cn("absolute inset-0 size-full object-contain transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
          style={{ imageRendering: scale > 2 ? "pixelated" : "auto" }}
        />
      </div>
    </div>
  );
}

/** Before/after comparison with a draggable divider. */
export function CompareSlider({ before, after, width, height, padding = 32 }: { before: string; after: string; width: number; height: number; padding?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef<HTMLDivElement>(null);
  const { w: cw, h: ch } = useSize(ref);
  const [pos, setPos] = React.useState(0.5);
  const fit = cw && ch ? Math.min((cw - padding * 2) / width, (ch - padding * 2) / height, 1) : 1;
  const move = (clientX: number) => {
    const r = frame.current!.getBoundingClientRect();
    setPos(clamp((clientX - r.left) / r.width, 0, 1));
  };
  return (
    <div ref={ref} className="relative h-full w-full">
      <div
        ref={frame}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 touch-none select-none"
        style={{ width: width * fit, height: height * fit }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && move(e.clientX)}
        role="slider"
        tabIndex={0}
        aria-label="Comparison divider"
        aria-valuenow={Math.round(pos * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPos((p) => clamp(p - 0.05, 0, 1));
          if (e.key === "ArrowRight") setPos((p) => clamp(p + 0.05, 0, 1));
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="After" className="absolute inset-0 size-full object-contain" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          alt="Before"
          className="absolute inset-0 size-full object-contain"
          style={{ clipPath: `inset(0 ${(1 - pos) * 100}% 0 0)` }}
          draggable={false}
        />
        <div className="absolute top-0 bottom-0 w-px bg-white/80" style={{ left: `${pos * 100}%` }}>
          <div className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-white/80 bg-black/60" />
        </div>
        <span className="label-meta absolute top-2 left-2 rounded-sm bg-black/60 px-1.5 py-0.5">Before</span>
        <span className="label-meta absolute top-2 right-2 rounded-sm bg-black/60 px-1.5 py-0.5">After</span>
      </div>
    </div>
  );
}
