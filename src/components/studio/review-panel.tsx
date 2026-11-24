"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, LoaderCircle, Plus, Sparkles } from "lucide-react";
import type { Generation, ImageReview } from "@/lib/domain/schemas";
import { REVIEW_CRITERIA_OPTIONS, type ReviewCriterion } from "@/lib/domain/vocab";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate } from "@/lib/client/resource";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, MetaLabel } from "@/components/common/primitives";
import { useApp } from "@/stores/app";
import { useStudio } from "@/stores/studio";

function Dots({ value, onChange, label }: { value: number; onChange?: (v: number) => void; label: string }) {
  return (
    <div className="flex gap-1" role={onChange ? "radiogroup" : undefined} aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          role={onChange ? "radio" : undefined}
          aria-checked={onChange ? value === n : undefined}
          aria-label={`${n} of 5`}
          onClick={() => onChange?.(value === n ? 0 : n)}
          className={cn("size-2.5 rounded-full border transition-colors", n <= value ? "border-foreground bg-foreground" : "border-text-muted/60", onChange && "hover:border-foreground")}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ImageReview }) {
  const update = useStudio((s) => s.update);
  return (
    <div className="space-y-3 rounded-md border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="label-meta">{review.kind === "ai" ? `AI review · ${review.model}` : "Manual review"}</span>
        <span className="text-[11px] text-text-muted">{formatDateTime(review.createdAt)}</span>
      </div>
      {review.driftDetected ? (
        <div className="flex gap-1.5 text-[12px] text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Possible style drift from the Style DNA.
        </div>
      ) : null}
      {review.summary ? <p className="text-[12.5px] leading-relaxed text-text-secondary">{review.summary}</p> : null}
      <div className="space-y-1.5">
        {REVIEW_CRITERIA_OPTIONS.filter((c) => review.criteria[c.key]).map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-text-muted">{c.label}</span>
            <Dots value={review.criteria[c.key] ?? 0} label={c.label} />
          </div>
        ))}
      </div>
      {review.findings.length ? (
        <ul className="space-y-1.5 border-t border-border pt-2">
          {review.findings.map((f, i) => (
            <li key={i} className="text-[11.5px] leading-snug text-text-secondary">
              <span className="text-text-muted">{f.criterion}: </span>
              {f.note}
            </li>
          ))}
        </ul>
      ) : null}
      {review.repetitionNotes ? <p className="text-[11.5px] text-text-muted">Repetition: {review.repetitionNotes}</p> : null}
      {review.suggestions.length ? (
        <div className="space-y-1.5 border-t border-border pt-2">
          <MetaLabel>Suggested prompt improvements</MetaLabel>
          {review.suggestions.map((sug, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <p className="text-[11.5px] leading-snug text-text-secondary">{sug}</p>
              <button
                type="button"
                className="flex shrink-0 items-center gap-0.5 text-[11px] text-text-muted hover:text-foreground"
                onClick={() => {
                  update((s) => ({ freeDirection: s.freeDirection ? `${s.freeDirection.trim()} ${sug}` : sug }));
                  toast.success("Added to free direction", { action: { label: "Undo", onClick: () => useStudio.getState().undo() } });
                }}
                aria-label="Add suggestion to free direction"
              >
                <Plus className="size-3" /> Use
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ReviewPanel({ g, reviews }: { g: Generation | null; reviews: ImageReview[] }) {
  const textAssist = useApp((s) => s.data?.textAssist);
  const [scores, setScores] = React.useState<Partial<Record<ReviewCriterion, number>>>({});
  const [summary, setSummary] = React.useState("");
  const [busy, setBusy] = React.useState<"manual" | "ai" | null>(null);
  React.useEffect(() => {
    setScores({});
    setSummary("");
  }, [g?.id]);

  if (!g || g.status !== "completed") return <EmptyState title="Nothing to review" description="Select a completed image to assess it against its Style DNA." />;

  const saveManual = async () => {
    setBusy("manual");
    try {
      const criteria = Object.fromEntries(Object.entries(scores).filter(([, v]) => v && v > 0));
      await api(`/api/generations/${g.id}/reviews`, { body: { criteria, summary } });
      invalidate(`/api/generations/${g.id}`);
      setScores({});
      setSummary("");
      toast.success("Assessment saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const runAi = async () => {
    setBusy("ai");
    try {
      await api(`/api/generations/${g.id}/ai-review`, { method: "POST" });
      invalidate(`/api/generations/${g.id}`);
      toast.success("AI review ready");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const scored = Object.values(scores).filter(Boolean).length;

  return (
    <div className="space-y-5 p-4">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <MetaLabel>Assess against Style DNA</MetaLabel>
          <span className="text-[11px] text-text-muted">{scored} of {REVIEW_CRITERIA_OPTIONS.length}</span>
        </div>
        <div className="space-y-2">
          {REVIEW_CRITERIA_OPTIONS.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-text-secondary">{c.label}</span>
              <Dots value={scores[c.key] ?? 0} label={c.label} onChange={(v) => setScores((s) => ({ ...s, [c.key]: v }))} />
            </div>
          ))}
        </div>
        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="Overall notes" className="resize-none text-[12.5px]" aria-label="Assessment notes" />
        <Button size="sm" variant="secondary" className="w-full" disabled={!scored || !!busy} onClick={() => void saveManual()}>
          Save assessment
        </Button>
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <Button size="sm" variant="secondary" className="w-full" disabled={!textAssist?.available || !!busy} onClick={() => void runAi()}>
          {busy === "ai" ? <LoaderCircle className="animate-spin" /> : <Sparkles />} AI visual review
        </Button>
        <p className="text-[11px] leading-snug text-text-muted">
          {textAssist?.available
            ? "Compares the image with its Style DNA and references. Scores are subjective creative guidance, never automatic decisions."
            : "AI review needs an OpenAI key on the server."}
        </p>
      </section>

      {reviews.length ? (
        <section className="space-y-2">
          <MetaLabel>History</MetaLabel>
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
