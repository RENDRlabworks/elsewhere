"use client";

import { Suspense } from "react";
import { CollectionsIndex } from "@/components/collections/collections-index";

export default function CollectionsPage() {
  return (
    <Suspense>
      <CollectionsIndex />
    </Suspense>
  );
}
