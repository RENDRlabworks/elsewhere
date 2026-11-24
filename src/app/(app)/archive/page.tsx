"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArchiveView } from "@/components/archive/archive-view";

function ArchiveFallback() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Loading archive">
      <div className="border-b border-border px-8 pt-7 pb-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-2 h-4 w-48" />
        <Skeleton className="mt-5 h-7 w-[36rem]" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-4 gap-y-6 px-8 pt-6">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5] w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

export default function ArchivePage() {
  return (
    <Suspense fallback={<ArchiveFallback />}>
      <ArchiveView />
    </Suspense>
  );
}
