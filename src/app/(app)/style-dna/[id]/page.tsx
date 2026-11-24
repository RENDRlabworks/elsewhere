"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { StyleEditor } from "@/components/style-dna/style-editor";

function Detail() {
  const { id } = useParams<{ id: string }>();
  return <StyleEditor id={id} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Detail />
    </Suspense>
  );
}
