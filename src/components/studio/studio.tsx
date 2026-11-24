"use client";

import * as React from "react";
import { Group, Panel, Separator, usePanelRef, type Layout } from "react-resizable-panels";
import { Skeleton } from "@/components/ui/skeleton";
import { useUi } from "@/stores/ui";
import { Canvas } from "./canvas";
import { Inspector } from "./inspector";
import { ScenePanel } from "./scene-panel";
import { useStudioSession } from "./use-studio-session";

const LAYOUT_KEY = "elsewhere.studio.layout";

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
    <Separator className="group relative w-px bg-border outline-none data-[separator=active]:bg-text-secondary data-[separator=hover]:bg-text-muted">
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
      <div className="flex h-full gap-px bg-border" aria-busy="true" aria-label="Loading studio">
        <div className="w-[320px] space-y-3 bg-background p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
        <div className="flex-1 bg-background p-10">
          <Skeleton className="mx-auto h-full max-w-xl" />
        </div>
        <div className="w-[340px] space-y-3 bg-background p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
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
      <Panel id="scene" panelRef={sceneRef} defaultSize="24" minSize={280} maxSize="40" collapsible collapsedSize={0} className="min-w-0">
        <ScenePanel session={session} />
      </Panel>
      <ResizeHandle />
      <Panel id="canvas" minSize="30" className="min-w-0">
        <Canvas session={session} />
      </Panel>
      <ResizeHandle />
      <Panel id="inspector" panelRef={inspectorRef} defaultSize="25" minSize={300} maxSize="42" collapsible collapsedSize={0} className="min-w-0">
        <Inspector session={session} />
      </Panel>
    </Group>
  );
}
