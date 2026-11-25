"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArrowUpRight, Inbox, Link2, LoaderCircle, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import type { Idea } from "@/lib/domain/schemas";
import { api, assetSrc, errorMessage } from "@/lib/client/api";
import { invalidate, mutateResource, useResource } from "@/lib/client/resource";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, PageTabs } from "@/components/common/primitives";
import { confirmAction } from "@/components/common/confirm";
import { Composer, INBOX_KEYS } from "./capture";

type Status = Idea["status"];
type ListResponse = { ideas: Idea[]; count: number };

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Ideas captured on the go, each one a click away from becoming a scene. */
export function InboxView() {
  const params = useSearchParams();
  const router = useRouter();
  const status: Status = params.get("status") === "used" ? "used" : params.get("status") === "archived" ? "archived" : "inbox";
  const key = `/api/inbox?status=${status}`;
  const { data, error, loading, reload } = useResource<ListResponse>(key);
  const capture = params.get("capture") === "1";

  // Arrivals from the phone's share sheet say how many were saved.
  const shared = params.get("shared");
  const [handled, setHandled] = React.useState<string | null>(null);
  if (shared && shared !== handled) {
    setHandled(shared);
    if (shared === "error") toast.error("That could not be saved to the inbox. Try sharing it again.");
    else if (shared !== "0") toast.success(Number(shared) > 1 ? `${shared} ideas saved to your inbox` : "Saved to your inbox");
  }

  const migration = (error as { code?: string } | undefined)?.code === "migration_required";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Inbox"
        tabs={
          <PageTabs
            items={[
              { href: "/inbox", label: "Inbox", active: status === "inbox", count: data?.count || null },
              { href: "/inbox?status=used", label: "Made into scenes", active: status === "used" },
              { href: "/inbox?status=archived", label: "Archived", active: status === "archived" },
            ]}
          />
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full max-w-[calc(42rem+4rem)] px-4 pt-2 pb-32 md:px-8">
          {status === "inbox" && !migration ? (
            <div className="mb-8">
              <Composer autoFocus={capture} pasteAnywhere onSaved={() => toast.success("Saved to your inbox")} />
            </div>
          ) : null}

          {migration ? (
            <EmptyState icon={Inbox} title="The inbox needs one more database step" description={error!.message} />
          ) : error && !data ? (
            <EmptyState
              title="The inbox could not be loaded"
              description={error.message}
              action={
                <Button size="sm" variant="secondary" onClick={() => void reload()}>
                  Try again
                </Button>
              }
            />
          ) : loading ? (
            <div className="flex h-32 items-center justify-center text-[13px] text-text-muted">
              <LoaderCircle className="mr-2 size-4 animate-spin" /> Loading ideas
            </div>
          ) : !data?.ideas.length ? (
            <EmptyState
              icon={Inbox}
              className="py-16"
              title={status === "inbox" ? "Nothing waiting" : status === "used" ? "No ideas made into scenes yet" : "Nothing archived"}
              description={
                status === "inbox"
                  ? "Write a line, paste a link or add a photo. On your phone, add Elsewhere to the home screen and share photos straight to it."
                  : undefined
              }
            />
          ) : (
            <ul className="space-y-3" aria-label="Ideas">
              {data.ideas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} listKey={key} onOpenScene={(id) => router.push(`/studio?scene=${id}`)} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function IdeaCard({ idea, listKey, onOpenScene }: { idea: Idea; listKey: string; onOpenScene: (sceneId: string) => void }) {
  const [busy, setBusy] = React.useState<"use" | "archive" | "delete" | null>(null);
  const photo = assetSrc(idea.assetId, "thumb");

  const drop = () => mutateResource<ListResponse>(listKey, (cur) => (cur ? { ...cur, ideas: cur.ideas.filter((i) => i.id !== idea.id) } : cur));

  async function makeScene() {
    setBusy("use");
    try {
      const { scene } = await api<{ scene: { id: string } }>(`/api/inbox/${idea.id}/use`, { method: "POST" });
      invalidate(...INBOX_KEYS, "/api/scenes");
      onOpenScene(scene.id);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  }

  async function setStatus(status: Status) {
    setBusy("archive");
    try {
      await api(`/api/inbox/${idea.id}`, { method: "PATCH", body: { status } });
      drop();
      invalidate(...INBOX_KEYS);
      if (status === "archived") {
        toast("Idea archived", { action: { label: "Undo", onClick: () => void api(`/api/inbox/${idea.id}`, { method: "PATCH", body: { status: "inbox" } }).then(() => invalidate(...INBOX_KEYS)) } });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const ok = await confirmAction({
      title: "Delete this idea?",
      description: photo ? "The idea and its photo are removed, unless the photo is already used in a scene." : "The idea is removed. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setBusy("delete");
    try {
      await api(`/api/inbox/${idea.id}`, { method: "DELETE" });
      drop();
      invalidate(...INBOX_KEYS);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  }

  return (
    <li className={cn("rounded-xl bg-surface p-4 transition-opacity", busy === "delete" && "opacity-50")}>
      <div className="flex gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="size-20 shrink-0 rounded-lg object-cover md:size-24" />
        ) : null}
        <div className="min-w-0 flex-1">
          {idea.text ? <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-foreground">{idea.text}</p> : null}
          {idea.url ? (
            <a href={idea.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[13px] text-text-secondary hover:text-foreground">
              <Link2 className="size-3.5 shrink-0" /> <span className="truncate">{host(idea.url)}</span>
            </a>
          ) : null}
          {!idea.text && !idea.url && photo ? <p className="text-[13px] text-text-muted">Photo</p> : null}
          <p className="mt-1.5 text-[11.5px] text-text-muted">
            {formatDate(idea.createdAt)}
            {idea.source === "shared" ? " · shared from another app" : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5">
        {idea.status === "inbox" ? (
          <>
            <Button size="sm" variant="ghost" className="text-text-muted" onClick={() => void remove()} disabled={!!busy} aria-label="Delete idea">
              <Trash2 />
            </Button>
            <Button size="sm" variant="ghost" className="text-text-secondary" onClick={() => void setStatus("archived")} disabled={!!busy}>
              <Archive /> Archive
            </Button>
            <Button size="sm" onClick={() => void makeScene()} disabled={!!busy}>
              {busy === "use" ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Make a scene
            </Button>
          </>
        ) : idea.status === "used" && idea.sceneId ? (
          <Button size="sm" variant="secondary" onClick={() => onOpenScene(idea.sceneId!)}>
            <ArrowUpRight /> Open scene
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="text-text-muted" onClick={() => void remove()} disabled={!!busy} aria-label="Delete idea">
              <Trash2 />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void setStatus("inbox")} disabled={!!busy}>
              <RotateCcw /> Back to inbox
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
