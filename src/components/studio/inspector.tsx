"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useResource } from "@/lib/client/resource";
import { DetailsPanel, type GenerationDetail } from "./details-panel";
import { PromptPanel } from "./prompt-panel";
import { ReviewPanel } from "./review-panel";
import type { StudioSession } from "./use-studio-session";

export function Inspector({ session }: { session: StudioSession }) {
  const g = session.selected;
  const [tab, setTab] = React.useState("prompt");
  const { data: detail } = useResource<GenerationDetail>(g && g.status === "completed" ? `/api/generations/${g.id}` : null);
  return (
    <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col gap-0 bg-background">
      <div className="flex h-11 shrink-0 items-center border-b border-border px-2">
        <TabsList className="h-7 bg-transparent p-0">
          <TabsTrigger value="prompt" className="h-7 px-2.5 text-[12px]">Prompt</TabsTrigger>
          <TabsTrigger value="details" className="h-7 px-2.5 text-[12px]">Image</TabsTrigger>
          <TabsTrigger value="review" className="h-7 px-2.5 text-[12px]">
            Review{detail?.reviews.length ? <span className="ml-1 font-mono text-[10px] text-text-muted">{detail.reviews.length}</span> : null}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="prompt" className="min-h-0 flex-1">
        <PromptPanel session={session} />
      </TabsContent>
      <TabsContent value="details" className="min-h-0 flex-1 overflow-y-auto">
        <DetailsPanel key={g?.id ?? "none"} g={detail?.generation ?? g} detail={detail} />
      </TabsContent>
      <TabsContent value="review" className="min-h-0 flex-1 overflow-y-auto">
        <ReviewPanel key={g?.id ?? "none"} g={g} reviews={detail?.reviews ?? []} />
      </TabsContent>
    </Tabs>
  );
}
