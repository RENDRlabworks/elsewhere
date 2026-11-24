"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ChevronRight, Copy, Dna, Lock, MoreHorizontal, Pencil, Plus, RefreshCw } from "lucide-react";
import type { StyleProfile } from "@/lib/domain/schemas";
import { assetSrc, errorMessage } from "@/lib/client/api";
import { useResource } from "@/lib/client/resource";
import { useApp, usePreferences, useProfiles } from "@/stores/app";
import { cn, formatDate } from "@/lib/utils";
import { EmptyState, MetaLabel, PageHeader } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createProfile, duplicateProfile, renameProfile, setActiveProfile, setArchived } from "./actions";
import { ProfileFormDialog } from "./profile-dialogs";

export function lockSummary(p: StyleProfile) {
  if (p.locked) return "Locked";
  const n = p.lockedAttributes.length;
  return n ? `${n} locked attribute${n === 1 ? "" : "s"}` : "Editable";
}

const activeIdOf = (prefs: { activeStyleProfileId: string | null } | undefined | null) => prefs?.activeStyleProfileId ?? null;

function ProfileCard({
  profile,
  active,
  onRename,
  covers,
}: {
  profile: StyleProfile;
  active: boolean;
  onRename: (p: StyleProfile) => void;
  /** Asset ids of this look's reference images, shown as its cover. */
  covers: string[];
}) {
  const router = useRouter();
  const hexes = profile.defaultPalette.map((s) => s.hex);
  return (
    <li className={cn("group relative flex flex-col overflow-hidden rounded-xl bg-surface transition-colors hover:bg-elevated", active && "ring-1 ring-text-muted/50", profile.archived && "opacity-70")}>
      <div className="flex aspect-[16/9] w-full overflow-hidden bg-elevated" aria-hidden>
        {covers.length
          ? covers.map((id) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={id} src={assetSrc(id)!} alt="" loading="lazy" className="h-full min-w-0 flex-1 object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            ))
          : hexes.map((h, i) => <span key={`${h}-${i}`} className="h-full flex-1" style={{ background: h }} />)}
      </div>
      <div className="flex flex-1 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/style-dna/${profile.id}`}
            className="block truncate text-[15px] font-medium text-foreground outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-1 focus-visible:after:outline-text-secondary"
          >
            {profile.name}
          </Link>
          <div className="mt-1 flex items-center gap-2 text-[11.5px] text-text-muted">
            <span className="font-mono">v{profile.currentVersion}</span>
            <span aria-hidden>·</span>
            <span className={cn("inline-flex items-center gap-1", profile.locked && "text-warning")}>
              {profile.locked ? <Lock className="size-3" /> : null}
              {lockSummary(profile)}
            </span>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-1">
          {active ? (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-interactive px-2.5 text-[11.5px] text-text-secondary">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              Active
            </span>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${profile.name}`} className="text-text-muted hover:text-foreground">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!profile.archived && !active ? (
                <DropdownMenuItem onSelect={() => void setActiveProfile(profile)}>
                  <Dna /> Set as active
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => onRename(profile)} disabled={profile.locked}>
                <Pencil /> Rename…
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  const copy = await duplicateProfile(profile);
                  if (copy) router.push(`/style-dna/${copy.id}`);
                }}
              >
                <Copy /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {profile.archived ? (
                <DropdownMenuItem onSelect={() => void setArchived(profile, false)}>
                  <ArchiveRestore /> Unarchive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void setArchived(profile, true)} disabled={active}>
                  <Archive /> Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-text-secondary">
        {profile.description || <span className="text-text-muted">No description yet.</span>}
      </p>
      <div className="mt-auto flex items-center justify-between pt-4 text-[11.5px] text-text-muted">
        <span>
          {covers.length ? `${covers.length} reference${covers.length === 1 ? "" : "s"}` : "No references yet"}
        </span>
        <span>Updated {formatDate(profile.updatedAt)}</span>
      </div>
      </div>
    </li>
  );
}

export function ProfileIndex() {
  const profiles = useProfiles();
  const prefs = usePreferences();
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [renaming, setRenaming] = React.useState<StyleProfile | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: refData } = useResource<{ references: { profileId: string | null; assetId: string; enabled: boolean }[] }>("/api/references");
  const coversFor = (id: string) =>
    (refData?.references ?? [])
      .filter((r) => r.profileId === id && r.enabled)
      .slice(0, 3)
      .map((r) => r.assetId);
  const live = profiles.filter((p) => !p.archived).sort((a, b) => Number(b.id === activeIdOf(prefs)) - Number(a.id === activeIdOf(prefs)));
  const archived = profiles.filter((p) => p.archived);
  const activeId = prefs?.activeStyleProfileId ?? null;

  // Pick up changes made elsewhere (another tab, the Studio) when the index opens.
  React.useEffect(() => {
    void useApp
      .getState()
      .refreshProfiles()
      .catch(() => {});
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      await useApp.getState().refreshProfiles();
    } catch (err) {
      toast.error("Could not refresh profiles", { description: errorMessage(err) });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Looks"
        description="Reusable visual identities. Each one carries its rendering rules, palette and reference images, with locks and an immutable version for every saved change."
        actions={
          <>
            <Button variant="ghost" size="icon-sm" onClick={() => void refresh()} aria-label="Refresh profiles" className="text-text-muted">
              <RefreshCw className={cn(refreshing && "animate-spin")} />
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New look
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] space-y-10 px-4 py-4 md:px-8 md:py-7">
          {live.length ? (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {live.map((p) => (
                <ProfileCard key={p.id} profile={p} active={p.id === activeId} onRename={setRenaming} covers={coversFor(p.id)} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Dna}
              title="No looks yet"
              description="Create a profile to describe a visual identity once and apply it to every scene."
              action={
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus /> New profile
                </Button>
              }
              className="rounded-lg border border-dashed border-border"
            />
          )}

          {archived.length ? (
            <section className="space-y-4">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                aria-expanded={showArchived}
                className="flex items-center gap-1.5 rounded-sm text-text-muted hover:text-text-secondary"
              >
                <ChevronRight className={cn("size-3.5 transition-transform", showArchived && "rotate-90")} />
                <MetaLabel className="text-inherit">Archived</MetaLabel>
                <span className="font-mono text-[11px] tabular-nums">{archived.length}</span>
              </button>
              {showArchived ? (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {archived.map((p) => (
                    <ProfileCard key={p.id} profile={p} active={false} onRename={setRenaming} covers={coversFor(p.id)} />
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      <ProfileFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="New look"
        description="Start with a name and a short description. You can define every attribute, the palette and references next."
        submitLabel="Create profile"
        onSubmit={async (v) => {
          const p = await createProfile(v);
          if (p) router.push(`/style-dna/${p.id}`);
          return !!p;
        }}
      />
      <ProfileFormDialog
        open={!!renaming}
        onOpenChange={(o) => !o && setRenaming(null)}
        title="Rename profile"
        description="Renaming saves a new version of the profile."
        submitLabel="Rename"
        withDescription={false}
        initialName={renaming?.name}
        onSubmit={async ({ name }) => {
          if (!renaming) return false;
          if (name === renaming.name) return true;
          return !!(await renameProfile(renaming, name));
        }}
      />
    </div>
  );
}
