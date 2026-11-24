"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ChevronRight, Copy, Dna, Lock, MoreHorizontal, Pencil, Plus, RefreshCw } from "lucide-react";
import type { StyleProfile } from "@/lib/domain/schemas";
import { errorMessage } from "@/lib/client/api";
import { useApp, usePreferences, useProfiles } from "@/stores/app";
import { cn, formatDate } from "@/lib/utils";
import { EmptyState, MetaLabel, PageHeader, SwatchStrip } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createProfile, duplicateProfile, renameProfile, setActiveProfile, setArchived } from "./actions";
import { ProfileFormDialog } from "./profile-dialogs";

export function lockSummary(p: StyleProfile) {
  if (p.locked) return "Locked";
  const n = p.lockedAttributes.length;
  return n ? `${n} locked attribute${n === 1 ? "" : "s"}` : "Editable";
}

function ProfileCard({
  profile,
  active,
  onRename,
}: {
  profile: StyleProfile;
  active: boolean;
  onRename: (p: StyleProfile) => void;
}) {
  const router = useRouter();
  const hexes = profile.defaultPalette.map((s) => s.hex);
  return (
    <li
      className={cn(
        "group relative flex min-h-[208px] flex-col rounded-lg border bg-surface p-5 transition-colors hover:bg-elevated",
        active ? "border-text-muted/60" : "border-border",
        profile.archived && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/style-dna/${profile.id}`}
            className="block truncate text-[15px] font-medium text-foreground outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-1 focus-visible:after:outline-text-secondary"
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
            <span className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-border px-2 text-[11px] text-text-secondary">
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

      <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-text-secondary">
        {profile.description || <span className="text-text-muted">No description yet.</span>}
      </p>

      <div className="mt-auto space-y-3 pt-5">
        {hexes.length ? <SwatchStrip hexes={hexes} className="h-3" /> : <div className="h-3 rounded-sm border border-dashed border-border" aria-label="No default palette" />}
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>Updated {formatDate(profile.updatedAt)}</span>
          {profile.presetKey ? <span>Preset</span> : null}
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

  const live = profiles.filter((p) => !p.archived);
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
        title="Style DNA"
        description="Reusable visual identities. Each one carries its rendering rules, palette and reference images, with locks and an immutable version for every saved change."
        actions={
          <>
            <Button variant="ghost" size="icon-sm" onClick={() => void refresh()} aria-label="Refresh profiles" className="text-text-muted">
              <RefreshCw className={cn(refreshing && "animate-spin")} />
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New profile
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] space-y-10 px-8 py-7">
          {live.length ? (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {live.map((p) => (
                <ProfileCard key={p.id} profile={p} active={p.id === activeId} onRename={setRenaming} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Dna}
              title="No Style DNA yet"
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
                    <ProfileCard key={p.id} profile={p} active={false} onRename={setRenaming} />
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
        title="New Style DNA"
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
