"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, X } from "lucide-react";
import type { Generation } from "@/lib/domain/schemas";
import { assetSrc } from "@/lib/client/api";
import { useResource } from "@/lib/client/resource";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { type CollectionDetailData, detailKey, seriesNumber } from "./lib";

const AUTOPLAY_MS = 7000;
const IDLE_MS = 2600;

type Slide = { g: Generation; number: string };

export function Presentation({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data, error, loading } = useResource<CollectionDetailData>(detailKey(id));
  const reduce = useReducedMotion();

  const slides: Slide[] = React.useMemo(
    () =>
      (data?.items ?? [])
        .map((item, i) => ({ g: item.generation, number: seriesNumber(item, i) }))
        .filter((s): s is Slide => !!s.g?.assetId && s.g.status === "completed"),
    [data],
  );

  const start = Number(params.get("i") ?? 0) || 0;
  const [index, setIndex] = React.useState(start);
  const [playing, setPlaying] = React.useState(false);
  const [idle, setIdle] = React.useState(false);
  const [isFull, setIsFull] = React.useState(false);
  const n = slides.length;
  const i = n ? ((index % n) + n) % n : 0;
  const cur = slides[i];

  const exit = React.useCallback(() => router.push(`/collections/${id}`), [router, id]);
  const go = React.useCallback((d: number) => setIndex((x) => x + d), []);

  // Hide the app chrome for the duration of the presentation.
  React.useEffect(() => {
    useUi.getState().setFullscreen(true);
    return () => useUi.getState().setFullscreen(false);
  }, []);

  React.useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Caption and controls fade after a short idle.
  const idleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wake = React.useCallback(() => {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
  }, []);
  React.useEffect(() => {
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  React.useEffect(() => {
    if (!playing || n < 2) return;
    const t = setInterval(() => setIndex((x) => x + 1), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [playing, n]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "Escape") wake();
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === "ArrowDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "ArrowUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "Home") {
        setIndex(0);
      } else if (e.key === "End") {
        setIndex(n - 1);
      } else if (e.key === "Escape") {
        // The browser leaves native fullscreen on the first Escape by itself.
        if (!document.fullscreenElement) exit();
      } else if (e.key.toLowerCase() === "f") {
        toggleNativeFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, exit, wake, n]);

  // Warm the next original so advancing feels instant.
  const next = n > 1 ? slides[(i + 1) % n] : null;
  React.useEffect(() => {
    if (!next) return;
    const img = new Image();
    img.src = assetSrc(next.g.assetId, "full")!;
  }, [next]);

  const chromeVisible = !idle || !cur;

  return (
    <div
      className={cn("fixed inset-0 z-40 bg-black text-white select-none", idle && "cursor-none")}
      onMouseMove={wake}
      role="region"
      aria-roledescription="slideshow"
      aria-label={data?.collection.name ?? "Presentation"}
    >
      {loading ? null : error || !data ? (
        <Centered>
          <p className="text-[13px] text-white/60">{error?.message ?? "Collection not found."}</p>
          <Link href="/collections" className="mt-4 text-[12.5px] text-white/80 underline underline-offset-4">
            All collections
          </Link>
        </Centered>
      ) : !cur ? (
        <Centered>
          <p className="text-editorial text-[22px] text-white/85">{data.collection.name}</p>
          <p className="mt-2 text-[13px] text-white/50">There are no finished images to present yet.</p>
          <Link href={`/collections/${id}`} className="mt-6 text-[12.5px] text-white/80 underline underline-offset-4">
            Back to the collection
          </Link>
        </Centered>
      ) : (
        <>
          <button
            type="button"
            className="absolute inset-0 flex cursor-[inherit] items-center justify-center px-[4vw] pt-16 pb-20 outline-none"
            onClick={(e) => {
              const left = e.clientX < window.innerWidth / 3;
              go(left ? -1 : 1);
              wake();
            }}
            aria-label="Next image. Click the left third for the previous image."
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.img
                key={cur.g.id}
                src={assetSrc(cur.g.assetId, "full")!}
                alt={cur.g.title}
                draggable={false}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.7, ease: [0.4, 0, 0.2, 1] }}
                className="max-h-full max-w-full object-contain"
              />
            </AnimatePresence>
          </button>

          <div className="sr-only" aria-live="polite">
            {`Image ${i + 1} of ${n}: ${cur.g.title}`}
          </div>

          {/* Caption */}
          <div
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 flex items-baseline gap-3 px-8 pb-7 transition-opacity duration-700",
              chromeVisible ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="font-mono text-[11px] text-white/40 tabular-nums">No. {cur.number}</span>
            <span className="text-editorial text-[15px] text-white/75">{cur.g.title}</span>
            <span className="font-mono text-[11px] text-white/35 tabular-nums">
              {i + 1} / {n}
            </span>
          </div>

          {/* Controls */}
          <div
            className={cn(
              "absolute top-0 right-0 left-0 flex items-center justify-between px-6 pt-5 transition-opacity duration-500",
              chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <div className="text-[12px] text-white/45">{data.collection.name}</div>
            <div className="flex items-center gap-1">
              <Ctl label={playing ? "Pause autoplay (Space)" : "Autoplay (Space)"} pressed={playing} onClick={() => setPlaying((p) => !p)}>
                {playing ? <Pause className="size-4" strokeWidth={1.5} /> : <Play className="size-4" strokeWidth={1.5} />}
              </Ctl>
              <Ctl label="Previous (Left arrow)" onClick={() => go(-1)}>
                <ChevronLeft className="size-4" strokeWidth={1.5} />
              </Ctl>
              <Ctl label="Next (Right arrow)" onClick={() => go(1)}>
                <ChevronRight className="size-4" strokeWidth={1.5} />
              </Ctl>
              <Ctl label={isFull ? "Exit full screen (F)" : "Full screen (F)"} pressed={isFull} onClick={toggleNativeFullscreen}>
                {isFull ? <Minimize className="size-4" strokeWidth={1.5} /> : <Maximize className="size-4" strokeWidth={1.5} />}
              </Ctl>
              <Ctl label="Exit presentation (Esc)" onClick={exit}>
                <X className="size-4" strokeWidth={1.5} />
              </Ctl>
            </div>
          </div>

          {playing && !reduce ? (
            <div className="absolute right-0 bottom-0 left-0 h-px bg-white/5" aria-hidden>
              <motion.div
                key={`${cur.g.id}-${i}`}
                className="h-full bg-white/30"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: AUTOPLAY_MS / 1000, ease: "linear" }}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function toggleNativeFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center text-center">{children}</div>;
}

function Ctl({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-white/55 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-1 focus-visible:ring-white/40",
        pressed && "text-white",
      )}
    >
      {children}
    </button>
  );
}
