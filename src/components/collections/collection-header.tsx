"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import type { Collection } from "@/lib/domain/schemas";
import { mutateResource, invalidate } from "@/lib/client/resource";
import { useProfiles } from "@/stores/app";
import { cn, formatDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MetaLabel } from "@/components/common/primitives";
import { type CollectionDetailData, detailKey, patchCollection, plural } from "./lib";

type Patch = Parameters<typeof patchCollection>[1];

/** Optimistically apply a patch to the cached detail, then persist it. */
export async function saveCollection(id: string, patch: Patch) {
  mutateResource<CollectionDetailData>(detailKey(id), (cur) => (cur ? { ...cur, collection: { ...cur.collection, ...patch } } : cur));
  const res = await patchCollection(id, patch);
  if (!res) invalidate(detailKey(id));
  return res;
}

export function CollectionHeader({ collection: c, imageCount, itemCount }: { collection: Collection; imageCount: number; itemCount: number }) {
  const profiles = useProfiles();
  const profile = c.styleProfileId ? profiles.find((p) => p.id === c.styleProfileId) : null;
  const progress = c.targetCount ? Math.min(1, imageCount / c.targetCount) : null;

  return (
    <header className="px-10 pt-10 pb-8">
      <MetaLabel className="mb-3">{c.isSeed ? "Seed series" : "Collection"}</MetaLabel>
      <InlineText
        value={c.name}
        label="Collection name"
        required
        maxLength={120}
        onSave={(name) => void saveCollection(c.id, { name })}
        className="text-editorial text-[28px] leading-9 text-foreground"
      />
      <InlineText
        value={c.description}
        label="Collection description"
        placeholder="Add a description of what ties this series together"
        multiline
        maxLength={2000}
        onSave={(description) => void saveCollection(c.id, { description })}
        className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary"
      />

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-text-muted">
        <span className="text-text-secondary">{plural(imageCount, "image")}</span>
        {itemCount > imageCount ? (
          <>
            <Dot />
            <span>{plural(itemCount - imageCount, "open slot")}</span>
          </>
        ) : null}
        {c.targetCount && progress !== null ? (
          <>
            <Dot />
            <span className="flex items-center gap-2">
              <span className="font-mono text-[11.5px] text-text-secondary tabular-nums">
                {imageCount} of {c.targetCount}
              </span>
              <span
                className="relative h-px w-16 bg-border"
                role="progressbar"
                aria-label="Progress toward target"
                aria-valuemin={0}
                aria-valuemax={c.targetCount}
                aria-valuenow={imageCount}
              >
                <span className="absolute inset-y-0 left-0 bg-text-secondary" style={{ width: `${progress * 100}%` }} />
              </span>
            </span>
          </>
        ) : null}
        <Dot />
        <span>Created {formatDate(c.createdAt)}</span>
        <Dot />
        <span>Modified {formatDate(c.updatedAt)}</span>
        <Dot />
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-sm text-text-secondary outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-text-secondary">
            {profile ? `Style DNA: ${profile.name}` : "No Style DNA"}
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="text-[11.5px] text-text-muted">Associated Style DNA</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={c.styleProfileId ?? ""}
              onValueChange={(v) => void saveCollection(c.id, { styleProfileId: v || null })}
            >
              <DropdownMenuRadioItem value="">None</DropdownMenuRadioItem>
              {profiles
                .filter((p) => !p.archived || p.id === c.styleProfileId)
                .map((p) => (
                  <DropdownMenuRadioItem key={p.id} value={p.id}>
                    {p.name}
                  </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
            {profile ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/style-dna/${profile.id}`}>Open {profile.name}</Link>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TagsEditor tags={c.tags} onChange={(tags) => void saveCollection(c.id, { tags })} />
      <NotesEditor key={c.id} collectionId={c.id} value={c.notes} />
    </header>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-border">
      /
    </span>
  );
}

/** Text that reads as typography and edits in place. Saves on blur, Escape reverts. */
function InlineText({
  value,
  onSave,
  label,
  placeholder,
  multiline,
  required,
  maxLength,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  className?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? value;
  const commit = () => {
    if (draft === null) return;
    const next = multiline ? draft.trim() : draft.trim().replace(/\s+/g, " ");
    setDraft(null);
    if (required && !next) return;
    if (next !== value) onSave(next);
  };
  const common = {
    value: shown,
    "aria-label": label,
    placeholder,
    maxLength,
    onFocus: () => setDraft(value),
    onBlur: commit,
    className: cn(
      "block w-full resize-none rounded-sm bg-transparent outline-none [field-sizing:content] placeholder:text-text-muted/70 hover:bg-surface/60 focus:bg-surface/60 focus-visible:ring-1 focus-visible:ring-border -mx-1.5 px-1.5",
      className,
    ),
  };
  if (multiline) {
    return (
      <textarea
        {...common}
        rows={1}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            const el = e.currentTarget;
            requestAnimationFrame(() => el.blur());
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
        }}
      />
    );
  }
  return (
    <input
      {...common}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          // Let the revert render before blurring so nothing is saved.
          const el = e.currentTarget;
          requestAnimationFrame(() => el.blur());
        }
      }}
    />
  );
}

function TagsEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = React.useState("");
  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
    setInput("");
    if (!t || tags.includes(t) || tags.length >= 20) return;
    onChange([...tags, t]);
  };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="Tags">
      {tags.map((t) => (
        <span key={t} className="inline-flex h-6 items-center gap-1 rounded-sm border border-border pr-1 pl-2 text-[11.5px] text-text-secondary">
          {t}
          <button
            type="button"
            aria-label={`Remove tag ${t}`}
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="inline-flex size-4 items-center justify-center rounded-sm text-text-muted hover:bg-interactive hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {tags.length < 20 ? (
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(input);
            } else if (e.key === "Backspace" && !input && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => input.trim() && add(input)}
          placeholder={tags.length ? "Add tag" : "Add tags"}
          aria-label="Add tag"
          className="h-6 w-24 rounded-sm bg-transparent px-1.5 text-[11.5px] text-foreground outline-none placeholder:text-text-muted hover:bg-surface focus:w-36 focus:bg-surface"
        />
      ) : null}
    </div>
  );
}

function NotesEditor({ collectionId, value }: { collectionId: string; value: string }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const shown = draft ?? value;
  const id = React.useId();

  async function commit() {
    if (draft === null) return;
    const next = draft;
    if (next === value) {
      setDraft(null);
      return;
    }
    setStatus("saving");
    const res = await saveCollection(collectionId, { notes: next });
    setDraft(null);
    setStatus(res ? "saved" : "error");
  }

  const firstLine = value.split("\n").find((l) => l.trim()) ?? "";

  return (
    <div className="mt-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={id}
          className="-ml-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-[12px] text-text-secondary outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-text-secondary"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          Notes
        </button>
        {!open && firstLine ? <span className="min-w-0 truncate text-[12px] text-text-muted">{firstLine}</span> : null}
        {open ? (
          <span className="text-[11.5px] text-text-muted" aria-live="polite">
            {status === "saving" ? (
              "Saving…"
            ) : status === "saved" && draft === null ? (
              <span className="inline-flex items-center gap-1">
                <Check className="size-3" /> Saved
              </span>
            ) : status === "error" ? (
              <span className="text-danger">Not saved</span>
            ) : draft !== null && draft !== value ? (
              "Unsaved, saves when you leave the field"
            ) : null}
          </span>
        ) : null}
      </div>
      {open ? (
        <textarea
          id={id}
          value={shown}
          onFocus={() => {
            setDraft(value);
            setStatus("idle");
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          placeholder="Curatorial notes, sequencing ideas, what is still missing."
          aria-label="Collection notes"
          maxLength={8000}
          rows={4}
          className="mt-2 block min-h-24 w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground outline-none [field-sizing:content] placeholder:text-text-muted focus-visible:border-text-muted"
        />
      ) : null}
    </div>
  );
}
