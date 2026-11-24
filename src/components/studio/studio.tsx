"use client";

import * as React from "react";
import { Group, Panel, Separator, usePanelRef, type Layout } from "react-resizable-panels";
import { Skeleton } from "@/components/ui/skeleton";
import { useUi } from "@/stores/ui";
import { Canvas } from "./canvas";
import { Inspector } from "./inspector";
import { DirectPanel } from "./direct-panel";
import { useStudioSession } from "./use-studio-session";

const LAYOUT_KEY = "elsewhere.create.layout";

function readLayout(): Layout | undefined {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? (JSON.parse(raw) as Layout) : undefined;
  } catch {
    return undefined;
  }
}

function ResizeHandle() {
  return (
    <Separator className="group relative w-px bg-border/60 outline-none data-[separator=active]:bg-text-secondary data-[separator=hover]:bg-text-muted">
      <span className="absolute inset-y-0 -left-1.5 w-3" />
    </Separator>
  );
}

export function Studio() {
  const session = useStudioSession();
  const { scenePanelOpen, inspectorOpen, fullscreen } = useUi();
  const sceneRef = usePanelRef();
  const inspectorRef = usePanelRef();
  const [layout] = React.useState(readLayout);

  React.useEffect(() => {
    const p = sceneRef.current;
    if (!p) return;
    if (scenePanelOpen && !fullscreen) p.expand();
    else p.collapse();
  }, [scenePanelOpen, fullscreen, sceneRef]);
  React.useEffect(() => {
    const p = inspectorRef.current;
    if (!p) return;
    if (inspectorOpen && !fullscreen) p.expand();
    else p.collapse();
  }, [inspectorOpen, fullscreen, inspectorRef]);

  if (session.booting) {
    return (
      <div className="flex h-full" aria-busy="true" aria-label="Loading studio">
        <div className="flex-1 p-12">
          <Skeleton className="mx-auto h-full max-w-xl rounded-xl" />
        </div>
        <div className="w-[360px] space-y-2 p-4">
          <Skeleton className="h-28 rounded-xl" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Group
      orientation="horizontal"
      defaultLayout={layout}
      onLayoutChanged={(l) => {
        try {
          localStorage.setItem(LAYOUT_KEY, JSON.stringify(l));
        } catch {}
      }}
      className="h-full"
    >
      <Panel id="canvas" minSize="40" className="min-w-0">
        <Canvas session={session} />
      </Panel>
      <ResizeHandle />
      <Panel id="details" panelRef={inspectorRef} defaultSize="0" minSize={300} maxSize="36" collapsible collapsedSize={0} className="min-w-0">
        <Inspector session={session} />
      </Panel>
      <ResizeHandle />
      <Panel id="direct" panelRef={sceneRef} defaultSize="26" minSize={320} maxSize="38" collapsible collapsedSize={0} className="min-w-0">
        <DirectPanel session={session} />
      </Panel>
    </Group>
  );
}
