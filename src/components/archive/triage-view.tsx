"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Heart, Share, SkipForward, Undo2, X } from "lucide-react";
import type { Generation } from "@/lib/domain/schemas";
import { assetSrc, errorMessage } from "@/lib/client/api";
import { useResource } from "@/lib/client/resource";
import { cn, formatDate } from "@/lib/utils";
import { useProfiles } from "@/stores/app";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { EmptyState } from "@/components/common/primitives";
import { patchGeneration } from "@/components/generation/actions";
import { useShareSheet } from "@/components/share/store";

type Decision = "accepted" | "rejected" | "skipped";
type Step = { id: string; decision: Decision; prevStatus: Generation["reviewStatus"]; favoriteBefore: boolean; favoriteAfter: boolean };

const LIMIT = 200;

/**
 * Triage: one image at a time, newest first, so a burst of generations can be
 * kept or rejected in a minute. Rejecting never deletes; the queue is fixed when
 * the session starts so decisions do not reshuffle it.
 */
export function TriageView() {
  const { data, error, reload } = useResource<{ items: Generation[]; total: number }>(`/api/generations?status=completed&filter=unreviewed&limit=${LIMIT}`);
  const [queue, setQueue] = React.useState<Generation[] | null>(null);
  if (data && !queue) setQueue(data.items.filter((g) => g.assetId));

  if (error && !data) {
    return (
      <EmptyState
        title="Images could not be loaded"
        description={error.message}
        action={
          <Button size="sm" variant="secondary" onClick={() => void reload()}>
            Try again
          </Button>
        }
      />
    );
  }
  if (!queue) return <div className="flex h-full items-center justify-center text-[13px] text-text-muted">Loading images to review</div>;
  return <Triage queue={queue} total={data?.total ?? queue.length} />;
}

function Triage({ queue, total }: { queue: Generation[]; total: number }) {
  const profiles = useProfiles();
  const [index, setIndex] = React.useState(0);
  const [history, setHistory] = React.useState<Step[]>([]);
  const [favorites, setFavorites] = React.useState<Record<string, boolean>>({});
  const [leaving, setLeaving] = React.useState<Decision | null>(null);
  const [dx, setDx] = React.useState(0);
  const drag = React.useRef<{ x: number; id: number } | null>(null);
  const busy = React.useRef(false);

  const g = queue[index] ?? null;
  const done = index >= queue.length;
  const decided = new Map(history.map((h) => [h.id, h.decision]));
  const kept = history.filter((h) => h.decision === "accepted");
  const rejected = history.filter((h) => h.decision === "rejected").length;
  const isFavorite = (x: Generation) => favorites[x.id] ?? x.favorite;

  const decide = React.useCallback(
    async (decision: Decision) => {
      if (!g || busy.current) return;
      busy.current = true;
      const step: Step = { id: g.id, decision, prevStatus: g.reviewStatus, favoriteBefore: g.favorite, favoriteAfter: favorites[g.id] ?? g.favorite };
      setLeaving(decision);
      try {
        if (decision !== "skipped") await patchGeneration(g.id, { reviewStatus: decision });
        setHistory((h) => [...h.filter((x) => x.id !== g.id), step]);
        setIndex((i) => i + 1);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setLeaving(null);
        setDx(0);
        busy.current = false;
      }
    },
    [g, favorites],
  );

  const toggleFavorite = React.useCallback(async () => {
    if (!g) return;
    const next = !(favorites[g.id] ?? g.favorite);
    setFavorites((f) => ({ ...f, [g.id]: next }));
    try {
      await patchGeneration(g.id, { favorite: next });
    } catch (err) {
      setFavorites((f) => ({ ...f, [g.id]: !next }));
      toast.error(errorMessage(err));
    }
  }, [g, favorites]);

  const undo = React.useCallback(async () => {
    const last = history.at(-1);
    if (!last || busy.current) return;
    busy.current = true;
    try {
      if (last.decision !== "skipped") await patchGeneration(last.id, { reviewStatus: last.prevStatus });
      setHistory((h) => h.slice(0, -1));
      setIndex(queue.findIndex((x) => x.id === last.id));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      busy.current = false;
    }
  }, [history, queue]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [role=dialog]")) return;
      if (e.metaKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "a" || k === "k") void decide("accepted");
      else if (k === "x" || k === "r") void decide("rejected");
      else if (k === "s") void decide("skipped");
      else if (k === "f") void toggleFavorite();
      else if (k === "z" || k === "u") void undo();
      else if (k === "arrowright") setIndex((i) => Math.min(queue.length, i + 1));
      else if (k === "arrowleft") setIndex((i) => Math.max(0, i - 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, toggleFavorite, undo, queue.length]);

  const reviewed = history.filter((h) => h.decision !== "skipped").length;
  const progress = queue.length ? Math.min(1, index / queue.length) : 1;
  const next = queue[index + 1];
  const profile = g?.styleProfileId ? profiles.find((p) => p.id === g.styleProfileId) : null;

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-4 px-4 md:px-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-text-secondary">
          <Link href="/archive">
            <ArrowLeft /> Library
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
          <span className="text-[13px] text-foreground">Review</span>
          <span className="text-[12px] text-text-muted tabular-nums" aria-live="polite">
            {done ? `${queue.length} of ${queue.length}` : `${index + 1} of ${queue.length}`}
            {total > queue.length ? ` · ${total - queue.length} more after these` : ""}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="text-text-secondary" disabled={!history.length} onClick={() => void undo()}>
          <Undo2 /> Undo
        </Button>
      </header>
      <div className="h-px shrink-0 bg-border" aria-hidden>
        <div className="h-px bg-foreground/70 transition-[width] duration-300 ease-out" style={{ width: `${progress * 100}%` }} />
      </div>

      {queue.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={Check}
            title="Nothing to review"
            description="Every finished image has been kept or rejected. New images land here after they generate."
            action={
              <Button asChild size="sm" variant="secondary">
                <Link href="/archive">Back to Library</Link>
              </Button>
            }
          />
        </div>
      ) : done ? (
        <Summary kept={kept.map((k) => k.id)} rejected={rejected} favorites={Object.values(favorites).filter(Boolean).length} reviewed={reviewed} onBack={() => setIndex(Math.max(0, queue.length - 1))} />
      ) : g ? (
        <>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-4 md:px-16">
            <button type="button" aria-label="Previous image" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="absolute left-3 hidden size-9 items-center justify-center rounded-full text-text-muted hover:bg-interactive hover:text-foreground disabled:opacity-0 md:flex">
              <ChevronLeft className="size-5" />
            </button>
            <div
              className="relative flex h-full w-full touch-pan-y items-center justify-center select-none"
              onPointerDown={(e) => {
                if (e.pointerType === "mouse") return;
                drag.current = { x: e.clientX, id: e.pointerId };
              }}
              onPointerMove={(e) => {
                if (drag.current?.id === e.pointerId) setDx(e.clientX - drag.current.x);
              }}
              onPointerUp={() => {
                const d = dx;
                drag.current = null;
                if (d > 90) void decide("accepted");
                else if (d < -90) void decide("rejected");
                else setDx(0);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setDx(0);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={g.id}
                src={assetSrc(g.assetId, "full")!}
                alt={g.title}
                draggable={false}
                className={cn(
                  "max-h-full max-w-full rounded-md object-contain shadow-2xl shadow-black/60 transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none",
                  leaving === "accepted" && "translate-x-8 opacity-0",
                  leaving === "rejected" && "-translate-x-8 opacity-0",
                  leaving === "skipped" && "opacity-0",
                )}
                style={dx ? { transform: `translateX(${dx}px) rotate(${dx / 40}deg)`, transition: "none" } : undefined}
              />
              {dx ? (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-6 rounded-md px-3 py-1 text-[13px] font-medium",
                    dx > 0 ? "right-6 bg-success/20 text-success" : "left-6 bg-danger/20 text-danger",
                  )}
                  style={{ opacity: Math.min(1, Math.abs(dx) / 90) }}
                >
                  {dx > 0 ? "Keep" : "Reject"}
                </span>
              ) : null}
              {decided.get(g.id) ? (
                <span className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-elevated px-2.5 py-0.5 text-[11.5px] text-text-secondary">
                  {decided.get(g.id) === "accepted" ? "Kept" : decided.get(g.id) === "rejected" ? "Rejected" : "Skipped"}
                </span>
              ) : null}
            </div>
            <button type="button" aria-label="Next image" onClick={() => setIndex((i) => Math.min(queue.length, i + 1))} className="absolute right-3 hidden size-9 items-center justify-center rounded-full text-text-muted hover:bg-interactive hover:text-foreground md:flex">
              <ChevronRight className="size-5" />
            </button>
            {next?.assetId ? <link rel="preload" as="image" href={assetSrc(next.assetId, "full")!} /> : null}
          </div>

          <div className="shrink-0 px-4 pb-5 md:px-6">
            <div className="mx-auto mb-4 max-w-xl text-center">
              <h1 className="truncate text-[15px] font-medium text-foreground">{g.title}</h1>
              <p className="mt-0.5 truncate text-[12px] text-text-muted">
                {[profile?.name, formatDate(g.createdAt)].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="mx-auto grid max-w-xl grid-cols-4 gap-2" role="group" aria-label="Review this image">
              <TriageButton label="Reject" keys={["X"]} icon={X} onClick={() => void decide("rejected")} className="hover:border-danger/60 hover:text-danger" />
              <TriageButton label="Skip" keys={["S"]} icon={SkipForward} onClick={() => void decide("skipped")} />
              <TriageButton label={isFavorite(g) ? "Favorited" : "Favorite"} keys={["F"]} icon={Heart} onClick={() => void toggleFavorite()} pressed={isFavorite(g)} className={isFavorite(g) ? "text-foreground [&_svg]:fill-current" : ""} />
              <TriageButton label="Keep" keys={["A"]} icon={Check} onClick={() => void decide("accepted")} primary />
            </div>
            <p className="mt-3 hidden text-center text-[11.5px] text-text-muted md:block">
              Arrow keys move without deciding. Rejected images stay in the Library under Rejected.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

function TriageButton({
  label,
  keys,
  icon: Icon,
  onClick,
  primary,
  pressed,
  className,
}: {
  label: string;
  keys: string[];
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  primary?: boolean;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-keyshortcuts={keys.join(" ")}
      className={cn(
        "flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-[12.5px] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-text-secondary active:scale-[0.98] md:h-12 md:flex-row md:gap-2",
        primary ? "border-foreground bg-foreground text-background hover:bg-foreground/90" : "border-border text-text-secondary hover:border-text-muted hover:text-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      <Kbd className={cn("hidden md:inline-flex", primary && "bg-background/10 text-background/70")}>{keys[0]}</Kbd>
    </button>
  );
}

function Summary({ kept, rejected, favorites, reviewed, onBack }: { kept: string[]; rejected: number; favorites: number; reviewed: number; onBack: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center">
        <Check className="mx-auto size-6 text-text-muted" />
        <h1 className="mt-4 text-[20px] font-medium text-foreground">{reviewed ? "Review done" : "End of the queue"}</h1>
        <p className="mt-2 text-[13px] text-text-secondary">
          {kept.length} kept · {rejected} rejected{favorites ? ` · ${favorites} favorited` : ""}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            Back to the last image
          </Button>
          {kept.length ? (
            <>
              <Button asChild variant="secondary" size="sm">
                <Link href="/archive?filter=accepted">See kept images</Link>
              </Button>
              <Button size="sm" onClick={() => useShareSheet.getState().show({ kind: "images", ids: kept })}>
                <Share /> Export kept
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/archive">Back to Library</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
