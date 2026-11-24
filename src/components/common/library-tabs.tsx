"use client";

import { PageTabs } from "./primitives";

/** Images and Collections are two views of one Library. */
export function LibraryTabs({ active, imageCount }: { active: "images" | "collections"; imageCount?: number | null }) {
  return (
    <PageTabs
      items={[
        { href: "/archive", label: "Images", active: active === "images", count: imageCount ?? null },
        { href: "/collections", label: "Collections", active: active === "collections" },
      ]}
    />
  );
}
