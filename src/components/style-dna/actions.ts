"use client";

import { toast } from "sonner";
import type { StyleProfile } from "@/lib/domain/schemas";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate } from "@/lib/client/resource";
import { useApp } from "@/stores/app";
import { runCommand } from "@/stores/ui";

export const profileKey = (id: string) => `/api/styles/${id}`;

function sync(profile: StyleProfile) {
  useApp.getState().upsertProfile(profile);
  invalidate(profileKey(profile.id));
}

export async function createProfile(input: { name: string; description: string }): Promise<StyleProfile | null> {
  try {
    const { profile } = await api<{ profile: StyleProfile }>("/api/styles", { method: "POST", body: input });
    sync(profile);
    toast.success(`Created "${profile.name}"`);
    return profile;
  } catch (err) {
    toast.error("Could not create the profile", { description: errorMessage(err) });
    return null;
  }
}

export async function duplicateProfile(p: StyleProfile): Promise<StyleProfile | null> {
  try {
    const { profile } = await api<{ profile: StyleProfile }>(`/api/styles/${p.id}/duplicate`, { method: "POST", body: {} });
    sync(profile);
    toast.success(`Duplicated as "${profile.name}"`);
    return profile;
  } catch (err) {
    toast.error("Could not duplicate the profile", { description: errorMessage(err) });
    return null;
  }
}

export async function setActiveProfile(p: StyleProfile) {
  try {
    await useApp.getState().updatePreferences({ activeStyleProfileId: p.id });
    runCommand("style-changed");
    toast.success(`Active look: ${p.name}`);
  } catch (err) {
    toast.error("Could not set the active profile", { description: errorMessage(err) });
  }
}

export async function setArchived(p: StyleProfile, archived: boolean) {
  try {
    const { profile } = await api<{ profile: StyleProfile }>(`/api/styles/${p.id}`, { method: "PATCH", body: { archived } });
    sync(profile);
    toast.success(archived ? `Archived "${p.name}"` : `Restored "${p.name}"`, {
      action: { label: "Undo", onClick: () => void setArchived(profile, !archived) },
    });
    return profile;
  } catch (err) {
    toast.error(archived ? "Could not archive the profile" : "Could not restore the profile", { description: errorMessage(err) });
    return null;
  }
}

export async function renameProfile(p: StyleProfile, name: string) {
  try {
    const { profile } = await api<{ profile: StyleProfile }>(`/api/styles/${p.id}`, { method: "PATCH", body: { name } });
    sync(profile);
    toast.success(`Renamed to "${profile.name}"`, { description: `Saved as version ${profile.currentVersion}.` });
    return profile;
  } catch (err) {
    toast.error("Could not rename the profile", { description: errorMessage(err) });
    return null;
  }
}

export async function setProfileLocked(p: StyleProfile, locked: boolean) {
  try {
    const { profile } = await api<{ profile: StyleProfile }>(`/api/styles/${p.id}/lock`, { method: "POST", body: { locked } });
    sync(profile);
    toast.success(locked ? `"${p.name}" is locked` : `"${p.name}" is unlocked`, {
      description: locked ? "Its attributes and palette are read-only until you unlock it." : undefined,
    });
    return profile;
  } catch (err) {
    toast.error("Could not change the lock", { description: errorMessage(err) });
    return null;
  }
}
