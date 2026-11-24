import { Suspense } from "react";
import type { Metadata } from "next";
import { Studio } from "@/components/studio/studio";

export const metadata: Metadata = { title: "Studio" };

export default function StudioPage() {
  return (
    <Suspense>
      <Studio />
    </Suspense>
  );
}
