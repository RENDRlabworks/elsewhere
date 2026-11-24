"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, FilePlus2, Images, Inbox, LoaderCircle, Shuffle, Upload } from "lucide-react";
import type { Generation, Idea, Scene } from "@/lib/domain/schemas";
import { api, assetSrc, errorMessage } from "@/lib/client/api";
import { invalidate, useResource } from "@/lib/client/resource";
import { cn, formatDate } from "@/lib/utils";
import { useStudio } from "@/stores/studio";
import { useProfiles } from "@/stores/app";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StartingImagePicker } from "./starting-image";
import { TabSwitcherButton } from "./tab-strip";
import type { StudioSession } from "./use-studio-session";

type Busy = string | null;

/**
 * Where Create begins: pick what to start from, or pick a recent scene back up.
 * Nothing from earlier work is on screen until you choose it.
 */
export function StartScreen({ session }: { session: StudioSession }) {
  const profiles = useProfiles();
  const scene = useStudio((s) => s.scene);
  const { data: gens } = useResource<{ items: Generation[] }>("/api/generations?status=completed&limit=100");
  const { data: scenes } = useResource<{ scenes: Scene[] }>("/api/scenes?status=draft");
  const { data: inboxCount } = useResource<{ count: number | null }>("/api/inbox/count");
  const [busy, setBusy] = React.useState<Busy>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [inboxOpen, setInboxOpen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const images = (gens?.items ?? []).filter((g) => g.assetId);
  const coverFor = new Map<string, string>();
  for (const g of images) if (g.sceneId && !coverFor.has(g.sceneId)) coverFor.set(g.sceneId, g.assetId!);
  const recent = (scenes?.scenes ?? []).slice(0, 6);
  const lookId = scene.styleProfileId ?? session.defaultsForNew().styleProfileId;
  const look = profiles.find((p) => p.id === lookId);

  const startFresh = () => useStudio.getState().resetScene({ ...session.defaultsForNew(), title: "Untitled scene" });

  async function run(key: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const fromImages = (ids: string[], copyScene: boolean) =>
    run(`img:${ids[0]}`, async () => {
      if (copyScene) await session.startFromImages(ids, { copyScene: true });
      else {
        startFresh();
        await session.startFromImages(ids);
      }
    });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-24 md:px-10 md:pt-14">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[24px] leading-8 font-medium tracking-[-0.01em] text-foreground">What are you starting from?</h1>
          <TabSwitcherButton session={session} className="-mt-0.5 -mr-1.5 md:hidden" />
        </div>
        <p className="mt-1.5 text-[13px] text-text-muted">{look ? `New scenes use ${look.name}. Change the look once you start.` : "Pick a way in."}</p>

        <section aria-labelledby="start-images" className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="start-images" className="text-[11px] tracking-[0.08em] text-text-muted uppercase">
              One of your images
            </h2>
            <button type="button" onClick={() => setPickerOpen(true)} className="text-[12.5px] text-text-secondary hover:text-foreground">
              Browse all
            </button>
          </div>
          {images.length ? (
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
              {images.slice(0, 6).map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => void fromImages([g.id], false)}
                  disabled={!!busy}
                  aria-label={`Start from ${g.title}`}
                  className={cn(
                    "group relative aspect-[4/5] overflow-hidden rounded-lg bg-surface outline-none focus-visible:ring-1 focus-visible:ring-text-secondary disabled:opacity-60",
                    i >= 3 && "max-md:hidden",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={assetSrc(g.assetId, "thumb")!} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pt-6 pb-1.5 text-left text-[11.5px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {busy === `img:${g.id}` ? <LoaderCircle className="size-3.5 animate-spin" /> : <span className="line-clamp-1">{g.title}</span>}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-surface px-4 py-6 text-[13px] text-text-muted">Images you make show up here to start from.</p>
          )}
          <p className="mt-2 text-[12px] text-text-muted">Its medium, grain and light carry over. You choose the subject and colour.</p>
        </section>

        <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <StartCard icon={Upload} title="Upload" hint="A file from this device" busy={busy === "upload"} disabled={!!busy} onClick={() => fileRef.current?.click()} />
          <StartCard
            icon={Inbox}
            title="An inbox idea"
            hint={inboxCount?.count ? `${inboxCount.count} waiting` : inboxCount?.count === null ? "Needs its migration" : "Nothing waiting yet"}
            disabled={!!busy || !inboxCount?.count}
            onClick={() => setInboxOpen(true)}
          />
          <StartCard
            icon={Shuffle}
            title="Surprise me"
            hint="A random scene to react to"
            busy={busy === "surprise"}
            disabled={!!busy}
            onClick={() =>
              void run("surprise", async () => {
                startFresh();
                await session.randomize();
              })
            }
          />
          <StartCard icon={FilePlus2} title="Blank scene" hint="Nothing filled in" busy={busy === "blank"} disabled={!!busy} onClick={() => void run("blank", () => session.newScene())} />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f)
              void run("upload", async () => {
                startFresh();
                await session.startFromUpload(f);
              });
          }}
        />

        {recent.length ? (
          <section aria-labelledby="start-recent" className="mt-12">
            <h2 id="start-recent" className="mb-3 text-[11px] tracking-[0.08em] text-text-muted uppercase">
              Pick up where you left off
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {recent.map((s) => {
                const cover = coverFor.get(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => void session.openSceneInTab(s)}
                      className="group flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-surface focus-visible:ring-1 focus-visible:ring-text-secondary"
                    >
                      <span className="size-12 shrink-0 overflow-hidden rounded-md bg-surface">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {cover ? <img src={assetSrc(cover, "thumb")!} alt="" className="size-full object-cover" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-foreground">{s.title || "Untitled scene"}</span>
                        <span className="block text-[12px] text-text-muted">Edited {formatDate(s.updatedAt)}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>

      <StartingImagePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        session={session}
        onUpload={() => {
          setPickerOpen(false);
          fileRef.current?.click();
        }}
        onPick={async (ids, copyScene) => {
          setPickerOpen(false);
          await fromImages(ids, copyScene);
        }}
      />
      <InboxPicker open={inboxOpen} onOpenChange={setInboxOpen} onScene={(s) => void session.openSceneInTab(s)} />
    </div>
  );
}

function StartCard({
  icon: Icon,
  title,
  hint,
  onClick,
  disabled,
  busy,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start gap-3 rounded-xl bg-surface p-4 text-left outline-none transition-colors hover:bg-elevated focus-visible:ring-1 focus-visible:ring-text-secondary disabled:opacity-50 disabled:hover:bg-surface"
    >
      {busy ? <LoaderCircle className="size-5 animate-spin text-text-secondary" /> : <Icon className="size-5 text-text-secondary" />}
      <span>
        <span className="block text-[14px] text-foreground">{title}</span>
        <span className="mt-0.5 block text-[12px] text-text-muted">{hint}</span>
      </span>
    </button>
  );
}

/** Choose an idea from the inbox; it becomes the new scene. */
function InboxPicker({ open, onOpenChange, onScene }: { open: boolean; onOpenChange: (o: boolean) => void; onScene: (scene: Scene) => void }) {
  const { data } = useResource<{ ideas: Idea[] }>(open ? "/api/inbox" : null);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function use(id: string) {
    setBusy(id);
    try {
      const { scene } = await api<{ scene: Scene }>(`/api/inbox/${id}/use`, { method: "POST" });
      invalidate("/api/inbox", "/api/scenes");
      onOpenChange(false);
      onScene(scene);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">Start from an idea</DialogTitle>
          <DialogDescription className="text-[12.5px]">The idea becomes a new scene and moves to Made into scenes.</DialogDescription>
        </DialogHeader>
        <ul className="-mx-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {!data ? (
            <li className="flex h-24 items-center justify-center text-[12.5px] text-text-muted">
              <LoaderCircle className="mr-2 size-3.5 animate-spin" /> Loading ideas
            </li>
          ) : (
            data.ideas.map((idea) => (
              <li key={idea.id}>
                <button
                  type="button"
                  onClick={() => void use(idea.id)}
                  disabled={!!busy}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface disabled:opacity-60")}
                >
                  {idea.assetId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={assetSrc(idea.assetId, "thumb")!} alt="" className="size-11 shrink-0 rounded-md object-cover" />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface">
                      <Images className="size-4 text-text-muted" />
                    </span>
                  )}
                  <span className="line-clamp-2 min-w-0 flex-1 text-[13.5px] text-foreground">{idea.text || idea.url || "Photo"}</span>
                  {busy === idea.id ? <LoaderCircle className="size-4 animate-spin text-text-muted" /> : null}
                </button>
              </li>
            ))
          )}
        </ul>
        <Button asChild variant="ghost" size="sm" className="self-start text-text-secondary">
          <Link href="/inbox">Open inbox</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
