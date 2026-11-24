"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { Presentation } from "@/components/collections/presentation";

function Present() {
  const { id } = useParams<{ id: string }>();
  return <Presentation key={id} id={id} />;
}

export default function PresentPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-40 bg-black" />}>
      <Present />
    </Suspense>
  );
}
