"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { REFERENCE_ROLE_OPTIONS, type ReferenceRole } from "@/lib/domain/vocab";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate } from "@/lib/client/resource";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/primitives";
import { useApp, useProfiles } from "@/stores/app";
import { useStyleReferencePicker } from "./actions";

/** Attach one or more existing images to a Style DNA reference board. */
export function StyleReferencePicker() {
  const router = useRouter();
  const { open, ids, close } = useStyleReferencePicker();
  const profiles = useProfiles().filter((p) => !p.archived);
  const activeId = useApp((s) => s.data?.preferences.activeStyleProfileId ?? null);
  const [profileId, setProfileId] = React.useState<string>("");
  const [role, setRole] = React.useState<ReferenceRole>("style");
  const [busy, setBusy] = React.useState(false);

  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setProfileId(activeId ?? profiles[0]?.id ?? "");
      setRole("style");
    }
  }

  const profile = profiles.find((p) => p.id === profileId);

  async function submit() {
    if (!profile) return;
    setBusy(true);
    try {
      const res = await api<{ references: unknown[] }>("/api/references/from-generation", {
        body: { generationIds: ids, profileId: profile.id, role },
      });
      invalidate("/api/references", `/api/styles/${profile.id}`);
      const n = res.references.length;
      toast.success(`Added ${n} reference${n === 1 ? "" : "s"} to ${profile.name}`, {
        description: "Switch them on in the Studio References panel whenever this Style DNA is selected.",
        action: { label: "View", onClick: () => router.push(`/style-dna/${profile.id}?tab=references`) },
      });
      close();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-medium">Use as style reference</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            {ids.length === 1 ? "This image" : `These ${ids.length} images`} will be attached to the Style DNA&apos;s reference board and
            sent to the model with new generations. The image itself is not copied or changed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Style DNA">
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger size="sm" className="h-8 w-full text-[12.5px]" aria-label="Style DNA">
                <SelectValue placeholder="Choose a Style DNA" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.id === activeId ? " (active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Role" hint="Primary style carries the look: medium, grain, texture and light. Colour and subject still come from each scene.">
            <Select value={role} onValueChange={(v) => setRole(v as ReferenceRole)}>
              <SelectTrigger size="sm" className="h-8 w-full text-[12.5px]" aria-label="Reference role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFERENCE_ROLE_OPTIONS.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button size="sm" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={!profile || busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : null}
            Add {ids.length > 1 ? `${ids.length} references` : "reference"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
