"use client";

import * as React from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { Dices, LoaderCircle } from "lucide-react";
import type { Character, SceneContent, SceneField } from "@/lib/domain/schemas";
import type { IdeaField } from "@/lib/domain/vocab";
import { CHARACTER_IDEA_FIELDS, hasIdeas, localIdeas } from "@/lib/explore/ideas";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApp } from "@/stores/app";
import { useStudio } from "@/stores/studio";
import { applySubjectChange } from "./subject-sync";

type Slot = "subject" | "secondarySubject";

/**
 * Ideas are fetched in small batches and handed out one per click, so only the
 * first click on a field waits for the model. A batch is reused while the rest of
 * the scene is unchanged; editing any other field asks for fresh ideas next time.
 */
const queues = new Map<string, string[]>();
let aiFailureShown = false;

const useBusy = create<{ busy: Record<string, boolean>; set: (k: string, v: boolean) => void }>((set) => ({
  busy: {},
  set: (k, v) => set((s) => ({ busy: { ...s.busy, [k]: v } })),
}));

const isCharacterField = (f: IdeaField) => CHARACTER_IDEA_FIELDS.includes(f);

function characterOf(scene: SceneContent, slot: Slot): Character | null {
  return slot === "secondarySubject" ? scene.secondarySubject : scene.subject;
}

function contextKey(field: IdeaField, slot: Slot, scene: SceneContent, character: Character) {
  const TEXT_KEYS = ["title", "description", "freeDirection", "environment", "phenomenon", "naturalElement", "materials", "lighting", "atmosphere", "emotionalTone", "timeOfDay", "styleProfileId"] as const;
  const ctx: Record<string, unknown> = Object.fromEntries(TEXT_KEYS.map((k) => [k, scene[k]]));
  ctx.character = { ...character };
  if (isCharacterField(field)) delete (ctx.character as Record<string, unknown>)[field === "subjectLabel" ? "label" : field];
  else delete ctx[field];
  return `${slot}:${field}:${JSON.stringify(ctx)}`;
}

async function nextIdea(field: IdeaField, slot: Slot, useAi: boolean): Promise<string | null> {
  const scene = useStudio.getState().scene;
  const character = characterOf(scene, slot) ?? scene.subject;
  const key = contextKey(field, slot, scene, character);
  const queued = queues.get(key);
  if (queued?.length) return queued.shift()!;

  let ideas: string[] = [];
  if (useAi) {
    try {
      const res = await api<{ ideas: string[] }>("/api/ideas", { body: { field, scene, character, count: 6, useAi: true } });
      ideas = res.ideas;
    } catch (err) {
      if (!aiFailureShown) {
        aiFailureShown = true;
        toast.error("AI ideas are unavailable, using built-in ideas instead", { description: errorMessage(err) });
      }
    }
  }
  if (!ideas.length) ideas = localIdeas(field, scene, { character, count: 6 });
  // Never hand back what is already in the field.
  const current = (isCharacterField(field) ? character[field === "subjectLabel" ? "label" : (field as "action" | "pose" | "clothing")] : scene[field as keyof SceneContent]) as string;
  ideas = ideas.filter((i) => i.trim().toLowerCase() !== (current ?? "").trim().toLowerCase());
  const first = ideas.shift() ?? null;
  queues.set(key, ideas);
  return first;
}

function apply(field: IdeaField, slot: Slot, idea: string) {
  const st = useStudio.getState();
  if (field === "subjectLabel") {
    const c = characterOf(st.scene, slot);
    if (c) applySubjectChange(slot, { ...c, label: idea });
  } else if (isCharacterField(field)) {
    const key = field;
    st.update((sc) => {
      const c = characterOf(sc, slot);
      return c ? { [slot]: { ...c, [key]: idea } } : {};
    });
  } else {
    st.update({ [field]: idea } as Partial<SceneContent>);
  }
}

/** A small "new idea" button for a free-text scene field. Respects field locks; undo restores the previous text. */
export function IdeaButton({ field, slot = "subject", label }: { field: IdeaField; slot?: Slot; label: string }) {
  const id = `${slot}:${field}`;
  const busy = useBusy((s) => !!s.busy[id]);
  const setBusy = useBusy((s) => s.set);
  const useAi = useApp((s) => !!s.data?.textAssist.available);
  const lockKey: SceneField = isCharacterField(field) ? slot : (field as SceneField);
  const locked = useStudio((s) => s.scene.lockedFields.includes(lockKey));
  const available = useStudio((s) => {
    const c = characterOf(s.scene, slot);
    return !isCharacterField(field) || (!!c && hasIdeas(field, c));
  });
  if (!available) return null;

  const onClick = async () => {
    if (busy || locked) return;
    setBusy(id, true);
    try {
      const idea = await nextIdea(field, slot, useAi);
      if (idea) apply(field, slot, idea);
      else toast("No new ideas for this field right now");
    } finally {
      setBusy(id, false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => void onClick()}
          disabled={locked}
          aria-label={`New idea for ${label}`}
          aria-busy={busy}
          className={cn(
            "flex size-5 items-center justify-center rounded-sm text-text-muted/80 transition-colors hover:bg-interactive hover:text-foreground",
            locked && "pointer-events-none opacity-30",
          )}
        >
          {busy ? <LoaderCircle className="size-3 animate-spin" /> : <Dices className="size-3" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{locked ? "Locked" : useAi ? "New idea, written for this scene" : "New idea"}</TooltipContent>
    </Tooltip>
  );
}
