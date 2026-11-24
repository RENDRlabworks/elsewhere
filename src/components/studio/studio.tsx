"use client";

import * as React from "react";
import { Group, Panel, Separator, usePanelRef, type Layout } from "react-resizable-panels";
import { Skeleton } from "@/components/ui/skeleton";
import { useUi } from "@/stores/ui";
import { useIsPhone } from "@/lib/client/use-media";
import { cn } from "@/lib/utils";
import { Canvas } from "./canvas";
import { Inspector } from "./inspector";
import { DirectPanel } from "./direct-panel";
import { StartScreen } from "./start-screen";
import { TabStrip, TabSwitcherButton } from "./tab-strip";
import { useStudio } from "@/stores/studio";
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

/**
 * On a phone the canvas and Direct take turns: one tap switches between them,
 * and starting a generation brings the image back into view.
 */
function PhoneStudio({ session }: { session: ReturnType<typeof useStudioSession> }) {
  const [view, setView] = React.useState<"image" | "direct">("image");
  const inspectorOpen = useUi((s) => s.inspectorOpen);
  const toggleInspector = useUi((s) => s.toggleInspector);
  const [wasGenerating, setWasGenerating] = React.useState(session.generating);
  if (session.generating !== wasGenerating) {
    setWasGenerating(session.generating);
    if (session.generating) setView("image");
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 pt-2 pb-1">
        <div role="tablist" aria-label="Create" className="grid flex-1 grid-cols-2 rounded-lg bg-surface p-0.5">
          {(["image", "direct"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("h-9 rounded-md text-[14px] transition-colors", view === v ? "bg-interactive text-foreground" : "text-text-muted")}
            >
              {v === "image" ? "Image" : "Direct"}
            </button>
          ))}
        </div>
        <TabSwitcherButton session={session} />
      </div>
      <div className="relative min-h-0 flex-1">
        <div className={cn("absolute inset-0", view !== "image" && "hidden")}>
          <Canvas session={session} />
        </div>
        <div className={cn("absolute inset-0", view !== "direct" && "hidden")}>
          <DirectPanel session={session} />
        </div>
        {inspectorOpen ? (
          <div className="absolute inset-0 z-20 flex flex-col bg-background">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
              <span className="text-[14px] text-foreground">Details</span>
              <button type="button" onClick={toggleInspector} className="text-[14px] text-text-secondary">
                Done
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Inspector session={session} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Studio() {
  const session = useStudioSession();
  const phone = useIsPhone();
  const startOpen = useStudio((s) => s.startOpen);
  const { scenePanelOpen, inspectorOpen, fullscreen } = useUi();
  const sceneRef = usePanelRef();
  const inspectorRef = usePanelRef();
  const [layout] = React.useState(readLayout);

  React.useEffect(() => {
    const p = sceneRef.current;
    if (!p) return;
    if (scenePanelOpen && !fullscreen) p.expand();
    else p.collapse();
  }, [scenePanelOpen, fullscreen, sceneRef, startOpen, phone]);
  React.useEffect(() => {
    const p = inspectorRef.current;
    if (!p) return;
    if (inspectorOpen && !fullscreen) p.expand();
    else p.collapse();
  }, [inspectorOpen, fullscreen, inspectorRef, startOpen, phone]);

  if (session.booting) {
    return (
      <div className="flex h-full" aria-busy="true" aria-label="Loading studio">
        <div className="flex-1 p-6 md:p-12">
          <Skeleton className="mx-auto h-full max-w-xl rounded-xl" />
        </div>
        <div className="hidden w-[360px] space-y-2 p-4 md:block">
          <Skeleton className="h-28 rounded-xl" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const body = startOpen ? (
    <StartScreen session={session} />
  ) : phone ? (
    <PhoneStudio session={session} />
  ) : (
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

  return (
    <div className="flex h-full flex-col">
      {!fullscreen ? <TabStrip session={session} /> : null}
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  );
}
