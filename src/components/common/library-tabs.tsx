"use client";

import { PageTabs } from "./primitives";

/** Images and Collections are two views of one Library. A search carries across both. */
export function LibraryTabs({ active, imageCount, collectionCount, q }: { active: "images" | "collections"; imageCount?: number | null; collectionCount?: number | null; q?: string }) {
  const suffix = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return (
    <PageTabs
      items={[
        { href: `/archive${suffix}`, label: "Images", active: active === "images", count: imageCount ?? null },
        { href: `/collections${suffix}`, label: "Collections", active: active === "collections", count: collectionCount ?? null },
      ]}
    />
  );
}
