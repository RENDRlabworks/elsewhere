"use client";

import * as React from "react";
import { History } from "lucide-react";
import {
  STYLE_ATTRIBUTE_KEYS,
  STYLE_ATTRIBUTE_LABELS,
  type StyleAttributeKey,
  type StyleProfile,
  type StyleProfileVersion,
  type StyleSnapshot,
} from "@/lib/domain/schemas";
import { cn, formatDateTime } from "@/lib/utils";
import { EmptyState, MetaLabel, SwatchStrip } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Diff = { name: boolean; description: boolean; palette: boolean; attributes: StyleAttributeKey[] };

export function diffSnapshots(a: StyleSnapshot, b: StyleSnapshot): Diff {
  return {
    name: a.name !== b.name,
    description: a.description !== b.description,
    palette: !same(
      a.defaultPalette.map((s) => s.hex),
      b.defaultPalette.map((s) => s.hex),
    ),
    attributes: STYLE_ATTRIBUTE_KEYS.filter((k) => !same(a.attributes[k], b.attributes[k])),
  };
}

function diffSummary(d: Diff) {
  const parts = [
    d.name ? "Name" : null,
    d.description ? "Description" : null,
    d.palette ? "Palette" : null,
    ...d.attributes.map((k) => STYLE_ATTRIBUTE_LABELS[k]),
  ].filter(Boolean) as string[];
  if (!parts.length) return "No content changes";
  if (parts.length <= 3) return parts.join(", ");
  return `${parts.slice(0, 3).join(", ")} and ${parts.length - 3} more`;
}

const currentSnapshot = (p: StyleProfile): StyleSnapshot => ({
  name: p.name,
  description: p.description,
  attributes: p.attributes,
  defaultPalette: p.defaultPalette,
});

function Value({ value }: { value: string | string[] }) {
  if (Array.isArray(value)) {
    return value.length ? (
      <div className="flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <span key={`${v}-${i}`} className="inline-flex h-6 items-center rounded-sm border border-border bg-elevated px-2 text-[12px]">
            {v}
          </span>
        ))}
      </div>
    ) : (
      <span className="text-text-muted">None</span>
    );
  }
  return value ? <span className="whitespace-pre-wrap">{value}</span> : <span className="text-text-muted">Not set</span>;
}

function SnapshotRow({ label, value, current, changed }: { label: string; value: React.ReactNode; current?: React.ReactNode; changed: boolean }) {
  return (
    <div className={cn("border-l-2 py-2.5 pr-2 pl-4", changed ? "border-warning/70" : "border-transparent")}>
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-text-secondary">{label}</span>
        {changed ? <span className="text-[10.5px] font-medium text-warning">Differs from current</span> : null}
      </div>
      <div className="mt-1 text-[12.5px] leading-relaxed text-foreground">{value}</div>
      {changed && current !== undefined ? (
        <div className="mt-2 rounded-md bg-background px-3 py-2 text-[12px] leading-relaxed text-text-muted">
          <div className="label-meta mb-1">Current</div>
          {current}
        </div>
      ) : null}
    </div>
  );
}

export function VersionDialog({
  version,
  profile,
  onClose,
  onLoad,
  canLoad,
}: {
  version: StyleProfileVersion | null;
  profile: StyleProfile;
  onClose: () => void;
  onLoad: (snapshot: StyleSnapshot) => void;
  canLoad: boolean;
}) {
  const [onlyDiff, setOnlyDiff] = React.useState(false);
  const snap = version?.snapshot;
  const cur = currentSnapshot(profile);
  const diff = snap ? diffSnapshots(snap, cur) : null;
  const isCurrent = version?.version === profile.currentVersion;
  const keys = snap ? STYLE_ATTRIBUTE_KEYS.filter((k) => !onlyDiff || diff?.attributes.includes(k)) : [];

  return (
    <Dialog open={!!version} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[86vh] flex-col gap-0 p-0 sm:max-w-3xl">
        {snap && diff && version ? (
          <>
            <DialogHeader className="border-b border-border px-6 pt-5 pb-4">
              <DialogTitle className="flex items-center gap-2 text-[14px]">
                <span className="font-mono">v{version.version}</span>
                <span className="font-normal text-text-secondary">{snap.name}</span>
                {isCurrent ? <span className="text-[11px] font-normal text-success">Current</span> : null}
              </DialogTitle>
              <DialogDescription className="text-[12px]">
                Saved {formatDateTime(version.createdAt)}. Read-only snapshot.{" "}
                {isCurrent ? "" : diff.attributes.length || diff.name || diff.description || diff.palette ? `Changed since: ${diffSummary(diff)}.` : "Identical to the current version."}
              </DialogDescription>
              {!isCurrent ? (
                <div className="mt-2 flex items-center gap-2">
                  <Switch id="only-diff" size="sm" checked={onlyDiff} onCheckedChange={setOnlyDiff} />
                  <Label htmlFor="only-diff" className="text-[12px] font-normal text-text-secondary">
                    Show only differences
                  </Label>
                </div>
              ) : null}
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4">
              {!onlyDiff || diff.name ? <SnapshotRow label="Name" value={snap.name} current={cur.name} changed={diff.name} /> : null}
              {!onlyDiff || diff.description ? (
                <SnapshotRow label="Description" value={<Value value={snap.description} />} current={<Value value={cur.description} />} changed={diff.description} />
              ) : null}
              {!onlyDiff || diff.palette ? (
                <SnapshotRow
                  label="Default palette"
                  value={snap.defaultPalette.length ? <SwatchStrip hexes={snap.defaultPalette.map((s) => s.hex)} className="max-w-sm" /> : <span className="text-text-muted">None</span>}
                  current={cur.defaultPalette.length ? <SwatchStrip hexes={cur.defaultPalette.map((s) => s.hex)} className="max-w-sm" /> : "None"}
                  changed={diff.palette}
                />
              ) : null}
              {keys.map((k) => (
                <SnapshotRow
                  key={k}
                  label={STYLE_ATTRIBUTE_LABELS[k]}
                  value={<Value value={snap.attributes[k]} />}
                  current={<Value value={cur.attributes[k]} />}
                  changed={diff.attributes.includes(k)}
                />
              ))}
              {onlyDiff && !keys.length && !diff.name && !diff.description && !diff.palette ? (
                <div className="px-4 py-8 text-center text-[12.5px] text-text-muted">No differences from the current version.</div>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
              <span className="text-[11.5px] text-text-muted">
                {canLoad ? "Loading copies this version into the editor. Nothing is saved until you save." : "Unlock the profile to load an earlier version."}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
                {!isCurrent ? (
                  <Button size="sm" variant="secondary" disabled={!canLoad} onClick={() => onLoad(snap)}>
                    Load into editor
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function VersionHistory({ versions, profile, onView }: { versions: StyleProfileVersion[]; profile: StyleProfile; onView: (v: StyleProfileVersion) => void }) {
  if (!versions.length) {
    return <EmptyState icon={History} title="No versions yet" description="Every saved change creates an immutable version you can review here." />;
  }
  return (
    <div className="space-y-3">
      <div>
        <MetaLabel>Version history</MetaLabel>
        <p className="mt-1.5 text-[12.5px] text-text-secondary">
          Every save creates an immutable snapshot. Generations record the exact version they used, so older images stay reproducible.
        </p>
      </div>
      <ol className="overflow-hidden rounded-lg border border-border">
        {versions.map((v, i) => {
          const prev = versions[i + 1];
          const summary = prev ? diffSummary(diffSnapshots(v.snapshot, prev.snapshot)) : "Created";
          const isCurrent = v.version === profile.currentVersion;
          return (
            <li key={v.id} className="flex items-center gap-4 border-b border-border bg-surface px-4 py-3 last:border-b-0">
              <span className="w-10 shrink-0 font-mono text-[12.5px] text-foreground">v{v.version}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] text-text-secondary">{summary}</div>
                <div className="text-[11px] text-text-muted">{formatDateTime(v.createdAt)}</div>
              </div>
              {isCurrent ? <span className="text-[11px] text-success">Current</span> : null}
              <Button variant="ghost" size="xs" onClick={() => onView(v)} className="text-text-secondary">
                View
              </Button>
            </li>
          );
        })}
      </ol>
      {versions.length >= 50 ? <p className="text-[11.5px] text-text-muted">Showing the 50 most recent versions.</p> : null}
    </div>
  );
}
