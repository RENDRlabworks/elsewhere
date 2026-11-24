"use client";

import { toast } from "sonner";
import type { Character } from "@/lib/domain/schemas";
import { CHARACTER_NOUNS } from "@/lib/domain/vocab";
import { listFields, retargetSubject } from "@/lib/scene/retarget";
import { useStudio } from "@/stores/studio";

type Slot = "subject" | "secondarySubject";

/**
 * Change one of the scene's characters and rewrite every other field that names it,
 * in a single undoable step. `previous` is the character as it was before an edit
 * that was typed in gradually (a description is applied when the field loses focus).
 */
export function applySubjectChange(slot: Slot, next: Character, previous?: Character) {
  const st = useStudio.getState();
  const current = st.scene[slot];
  if (!current) return st.update({ [slot]: next });
  const base = previous ? { ...st.scene, [slot]: previous } : st.scene;
  const { patch, changed, unresolved } = retargetSubject(base, slot, next, { skip: st.scene.lockedFields });
  st.update(patch);
  const after = (patch[slot] as Character | undefined) ?? next;
  const noun = after.kind === "none" ? null : after.label.trim() || CHARACTER_NOUNS[after.kind][0];
  if (changed.length) {
    toast(`Updated the ${listFields(changed)} to match${noun ? ` the ${noun.replace(/^(a|an|the)\s+/i, "")}` : ""}`, {
      action: { label: "Undo", onClick: () => useStudio.getState().undo() },
    });
  }
  if (unresolved.length) {
    toast(`The ${listFields(unresolved)} still mention${unresolved.length === 1 ? "s" : ""} the previous subject`, {
      description: next.kind === "none" ? "Edit them, or use the dice for new ideas." : "They are locked, so they were left as they are.",
    });
  }
}
