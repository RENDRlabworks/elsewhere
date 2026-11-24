"use client";

import { toast } from "sonner";
import type { Collection } from "@/lib/domain/schemas";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate } from "@/lib/client/resource";
import { confirmAction } from "@/components/common/confirm";

export async function duplicateCollection(c: Pick<Collection, "id" | "name">, onOpen?: (id: string) => void) {
  try {
    const { collection } = await api<{ collection: Collection }>(`/api/collections/${c.id}/duplicate`, { method: "POST" });
    invalidate("/api/collections");
    toast.success(`Duplicated as ${collection.name}`, onOpen ? { action: { label: "Open", onClick: () => onOpen(collection.id) } } : undefined);
    return collection;
  } catch (err) {
    toast.error(errorMessage(err));
    return null;
  }
}

export async function deleteCollection(c: Pick<Collection, "id" | "name" | "isSeed">): Promise<boolean> {
  const ok = await confirmAction({
    title: `Delete "${c.name}"?`,
    description: c.isSeed
      ? "The collection, its ordering and its open scene slots are removed. Every image stays in the archive, and the scenes stay available in Create."
      : "The collection and its ordering are removed. Every image stays in the archive.",
    confirmLabel: "Delete collection",
    destructive: true,
  });
  if (!ok) return false;
  try {
    await api(`/api/collections/${c.id}`, { method: "DELETE" });
    invalidate("/api/collections");
    toast.success("Collection deleted. Images remain in the archive.");
    return true;
  } catch (err) {
    toast.error(errorMessage(err));
    return false;
  }
}
