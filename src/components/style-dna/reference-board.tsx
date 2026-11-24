"use client";

import * as React from "react";
import { toast } from "sonner";
import { ImagePlus, ImageUp, Loader2, Trash2 } from "lucide-react";
import type { Asset, ReferenceImage } from "@/lib/domain/schemas";
import { REFERENCE_ROLE_OPTIONS, type ReferenceRole } from "@/lib/domain/vocab";
import { api, assetSrc, errorMessage } from "@/lib/client/api";
import { invalidate, mutateResource, useResource } from "@/lib/client/resource";
import { cn } from "@/lib/utils";
import { confirmAction } from "@/components/common/confirm";
import { EmptyState, IconButton, MetaLabel, SwatchStrip } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { profileKey } from "./actions";

export type ReferenceWithAsset = ReferenceImage & { asset: Asset | null };
type RefList = { references: ReferenceWithAsset[] };

export const referencesKey = (profileId: string) => `/api/references?profileId=${profileId}`;

const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"];
const MAX_BYTES = 25 * 1024 * 1024;

export function useReferences(profileId: string) {
  return useResource<RefList>(referencesKey(profileId));
}

function ReferenceCard({
  item,
  readOnly,
  onPatch,
  onDelete,
}: {
  item: ReferenceWithAsset;
  readOnly: boolean;
  onPatch: (patch: Partial<Pick<ReferenceImage, "role" | "label" | "notes" | "enabled">>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = React.useState(item.label);
  const [notes, setNotes] = React.useState(item.notes);
  const src = assetSrc(item.asset?.id ?? item.assetId);
  const w = item.asset?.width ?? 0;
  const h = item.asset?.height ?? 0;

  return (
    <li className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-surface", !item.enabled && "bg-background")}>
      <div className="relative aspect-[4/3] overflow-hidden bg-background">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.label || "Reference image"}
            loading="lazy"
            className={cn("absolute inset-0 size-full object-contain transition-opacity", !item.enabled && "opacity-35 grayscale")}
          />
        ) : null}
        {!item.enabled ? (
          <span className="absolute top-2 left-2 rounded-sm bg-black/70 px-1.5 py-0.5 text-[10.5px] text-text-secondary">Disabled</span>
        ) : null}
      </div>
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <Input
            value={label}
            readOnly={readOnly}
            maxLength={120}
            aria-label="Reference label"
            placeholder="Label"
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => label !== item.label && onPatch({ label: label.trim() })}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="h-7 border-transparent bg-transparent px-1.5 text-[12.5px] hover:border-input focus-visible:border-ring md:text-[12.5px] dark:bg-transparent"
          />
          <Switch
            size="sm"
            checked={item.enabled}
            disabled={readOnly}
            onCheckedChange={(enabled) => onPatch({ enabled })}
            aria-label={item.enabled ? "Disable reference" : "Enable reference"}
          />
        </div>
        <Select value={item.role} disabled={readOnly} onValueChange={(role) => onPatch({ role: role as ReferenceRole })}>
          <SelectTrigger size="sm" className="h-7 w-full text-[12px]" aria-label="Reference role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {REFERENCE_ROLE_OPTIONS.map((o) => (
              <SelectItem key={o.key} value={o.key} className="text-[12.5px]">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={notes}
          readOnly={readOnly}
          maxLength={1000}
          aria-label="Reference notes"
          placeholder={readOnly ? "No notes" : "Notes: what to take from this image"}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== item.notes && onPatch({ notes })}
          className="min-h-[34px] resize-none px-2 py-1.5 text-[12px] leading-relaxed md:text-[12px]"
        />
        {item.asset?.dominantColors.length ? <SwatchStrip hexes={item.asset.dominantColors} size="sm" /> : null}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-text-muted tabular-nums">{w && h ? `${w} × ${h}` : "Unknown size"}</span>
          {!readOnly ? <IconButton icon={Trash2} label="Delete reference" size="icon-xs" onClick={onDelete} /> : null}
        </div>
      </div>
    </li>
  );
}

export function ReferenceBoard({ profileId, readOnly }: { profileId: string; readOnly: boolean }) {
  const key = referencesKey(profileId);
  const { data, loading, error, reload } = useReferences(profileId);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState<{ done: number; total: number } | null>(null);
  const dragDepth = React.useRef(0);
  const refs = data?.references ?? [];

  async function upload(files: File[]) {
    if (readOnly) return;
    const valid = files.filter((f) => ACCEPT.includes(f.type) && f.size <= MAX_BYTES);
    const skipped = files.length - valid.length;
    if (skipped) toast.warning(`${skipped} file${skipped === 1 ? "" : "s"} skipped`, { description: "Use PNG, JPEG, WebP, AVIF or GIF images up to 25 MB." });
    if (!valid.length) return;
    setUploading({ done: 0, total: valid.length });
    let ok = 0;
    for (const file of valid) {
      const form = new FormData();
      form.set("file", file);
      form.set("profileId", profileId);
      form.set("role", "style");
      form.set("label", file.name.replace(/\.[^.]+$/, "").slice(0, 120));
      try {
        const { reference } = await api<{ reference: ReferenceWithAsset }>("/api/references", { method: "POST", form });
        mutateResource<RefList>(key, (cur) => ({ references: [...(cur?.references ?? []), reference] }));
        ok++;
      } catch (err) {
        toast.error(`Could not upload ${file.name}`, { description: errorMessage(err) });
      }
      setUploading((u) => (u ? { ...u, done: u.done + 1 } : u));
    }
    setUploading(null);
    invalidate(key, profileKey(profileId));
    if (ok) toast.success(`Added ${ok} reference${ok === 1 ? "" : "s"}`);
  }

  async function patch(item: ReferenceWithAsset, body: Partial<Pick<ReferenceImage, "role" | "label" | "notes" | "enabled">>) {
    mutateResource<RefList>(key, (cur) => cur && { references: cur.references.map((r) => (r.id === item.id ? { ...r, ...body } : r)) });
    try {
      await api(`/api/references/${item.id}`, { method: "PATCH", body });
    } catch (err) {
      toast.error("Could not update the reference", { description: errorMessage(err) });
      void reload();
    }
  }

  async function remove(item: ReferenceWithAsset) {
    const ok = await confirmAction({
      title: `Delete "${item.label || "this reference"}"?`,
      description: "The image file is permanently deleted. Generations that already used it keep their record.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api(`/api/references/${item.id}`, { method: "DELETE" });
      mutateResource<RefList>(key, (cur) => cur && { references: cur.references.filter((r) => r.id !== item.id) });
      invalidate(profileKey(profileId));
      toast.success("Reference deleted");
    } catch (err) {
      toast.error("Could not delete the reference", { description: errorMessage(err) });
    }
  }

  const enabled = refs.filter((r) => r.enabled).length;

  return (
    <div
      className="relative space-y-5"
      onDragEnter={(e) => {
        if (readOnly || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (readOnly || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        if (readOnly) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(e) => {
        if (readOnly) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void upload(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <MetaLabel>Reference board</MetaLabel>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-secondary">
            Images that show what this identity looks like. Give each a role so the prompt knows what to take from it.
          </p>
          <p className="mt-1 text-[11.5px] text-text-muted">
            References are submitted to the provider only when the selected model supports image references. Disabled references are kept but never sent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refs.length ? (
            <span className="text-[11.5px] text-text-muted">
              {enabled} of {refs.length} enabled
            </span>
          ) : null}
          {!readOnly ? (
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={!!uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />}
              {uploading ? `Uploading ${uploading.done + 1} of ${uploading.total}` : "Upload images"}
            </Button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void upload(files);
          }}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-border px-4 py-6 text-[12.5px] text-text-muted">
          References could not be loaded.{" "}
          <button type="button" className="text-text-secondary underline underline-offset-2" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      ) : refs.length ? (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          {refs.map((r) => (
            <ReferenceCard key={r.id} item={r} readOnly={readOnly} onPatch={(b) => void patch(r, b)} onDelete={() => void remove(r)} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={ImagePlus}
          title="No references yet"
          description={
            readOnly
              ? "This profile is locked. Unlock it to add reference images."
              : "Drop images here or upload them. Reference images anchor style, composition, lighting and colour."
          }
          action={
            !readOnly ? (
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                <ImageUp /> Upload images
              </Button>
            ) : undefined
          }
          className="rounded-lg border border-dashed border-border"
        />
      )}

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border border-dashed border-text-secondary bg-background/85">
          <div className="text-center">
            <ImageUp className="mx-auto mb-2 size-5 text-text-secondary" strokeWidth={1.5} />
            <div className="text-[13px] text-foreground">Drop to add references</div>
            <div className="text-[11.5px] text-text-muted">PNG, JPEG, WebP, AVIF or GIF, up to 25 MB each</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
