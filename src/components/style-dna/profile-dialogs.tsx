"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Name and description form used for creating and renaming profiles. */
export function ProfileFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initialName = "",
  initialDescription = "",
  withDescription = true,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  initialName?: string;
  initialDescription?: string;
  withDescription?: boolean;
  onSubmit: (values: { name: string; description: string }) => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-md">
        {open ? (
          <ProfileForm
            title={title}
            description={description}
            submitLabel={submitLabel}
            initialName={initialName}
            initialDescription={initialDescription}
            withDescription={withDescription}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProfileForm({
  title,
  description,
  submitLabel,
  initialName,
  initialDescription,
  withDescription,
  onSubmit,
  onCancel,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  initialName: string;
  initialDescription: string;
  withDescription: boolean;
  onSubmit: (values: { name: string; description: string }) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(initialName);
  const [desc, setDesc] = React.useState(initialDescription);
  const [busy, setBusy] = React.useState(false);
  const valid = name.trim().length > 0 && name.trim().length <= 80;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const ok = await onSubmit({ name: name.trim(), description: desc.trim() });
    setBusy(false);
    if (ok) onCancel();
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-[14px]">{title}</DialogTitle>
        {description ? <DialogDescription className="text-[12.5px]">{description}</DialogDescription> : null}
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="profile-name" className="text-[12px] font-normal text-text-secondary">
          Name
        </Label>
        <Input id="profile-name" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="text-[13px]" />
      </div>
      {withDescription ? (
        <div className="space-y-1.5">
          <Label htmlFor="profile-description" className="text-[12px] font-normal text-text-secondary">
            Description
          </Label>
          <Textarea
            id="profile-description"
            value={desc}
            maxLength={1000}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What this visual identity is for, in a sentence or two."
            className="min-h-20 text-[13px]"
          />
        </div>
      ) : null}
      <DialogFooter className="bg-transparent">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!valid || busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
