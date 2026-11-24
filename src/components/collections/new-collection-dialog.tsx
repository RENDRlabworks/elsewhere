"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Collection } from "@/lib/domain/schemas";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate } from "@/lib/client/resource";
import { useProfiles } from "@/stores/app";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/primitives";

const NONE = "__none";

export function NewCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (c: Collection) => void;
}) {
  const profiles = useProfiles();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [profileId, setProfileId] = React.useState(NONE);
  const [target, setTarget] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setProfileId(NONE);
    setTarget("");
  };

  const targetNum = target.trim() ? Number(target) : null;
  const targetInvalid = targetNum !== null && (!Number.isInteger(targetNum) || targetNum < 1 || targetNum > 500);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || targetInvalid) return;
    setBusy(true);
    try {
      const { collection } = await api<{ collection: Collection }>("/api/collections", {
        method: "POST",
        body: {
          name: name.trim(),
          description: description.trim(),
          styleProfileId: profileId === NONE ? null : profileId,
          targetCount: targetNum,
        },
      });
      invalidate("/api/collections");
      toast.success(`Created ${collection.name}`);
      reset();
      onOpenChange(false);
      onCreated?.(collection);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const active = profiles.filter((p) => !p.archived);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-medium">New collection</DialogTitle>
          <DialogDescription className="text-[12.5px]">A curated series. Add images from the Studio or the Archive once it exists.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name" htmlFor="nc-name">
            <Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Elsewhere: Volume II" autoFocus maxLength={120} />
          </Field>
          <Field label="Description" htmlFor="nc-desc" hint="Optional. What ties the series together.">
            <Textarea id="nc-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className="text-[13px]" />
          </Field>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Style DNA" htmlFor="nc-style">
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger id="nc-style" className="w-full text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={NONE}>None</SelectItem>
                  {active.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Target count" htmlFor="nc-target">
              <Input
                id="nc-target"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Open"
                aria-invalid={targetInvalid || undefined}
                className="font-mono text-[12px]"
              />
            </Field>
          </div>
          {targetInvalid ? <div className="text-[11.5px] text-danger">Target count must be a whole number from 1 to 500.</div> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || targetInvalid || busy}>
              {busy ? "Creating…" : "Create collection"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
