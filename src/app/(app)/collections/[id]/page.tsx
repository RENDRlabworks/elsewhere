"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { CollectionDetail, DetailSkeleton } from "@/components/collections/collection-detail";

function Detail() {
  const { id } = useParams<{ id: string }>();
  return <CollectionDetail key={id} id={id} />;
}

export default function CollectionPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Detail />
    </Suspense>
  );
}
