import type { Metadata } from "next";
import { TriageView } from "@/components/archive/triage-view";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return <TriageView />;
}
