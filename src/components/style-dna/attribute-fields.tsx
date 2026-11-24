"use client";

import * as React from "react";
import { X } from "lucide-react";
import { STYLE_ATTRIBUTE_LABELS, type StyleAttributeKey } from "@/lib/domain/schemas";
import { cn } from "@/lib/utils";
import { LockToggle } from "@/components/common/primitives";
import { Textarea } from "@/components/ui/textarea";

const editedMark = <span className="text-[10.5px] font-medium text-info">Edited</span>;

function FieldShell({
  attr,
  htmlFor,
  locked,
  lockDisabled,
  onToggleLock,
  edited,
  readOnlyReason,
  hint,
  children,
}: {
  attr: StyleAttributeKey;
  htmlFor: string;
  locked: boolean;
  lockDisabled?: boolean;
  onToggleLock: () => void;
  edited: boolean;
  readOnlyReason?: string | null;
  hint?: string;
  children: React.ReactNode;
}) {
  const label = STYLE_ATTRIBUTE_LABELS[attr];
  return (
    <div className="space-y-1.5" id={`attr-${attr}`}>
      <div className="flex h-5 items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[12px] text-text-secondary">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {edited ? editedMark : null}
          <LockToggle locked={locked} onToggle={onToggleLock} label={label} disabled={lockDisabled} />
        </div>
      </div>
      {children}
      {readOnlyReason ? (
        <div className="text-[11.5px] text-warning/80">{readOnlyReason}</div>
      ) : hint ? (
        <div className="text-[11.5px] text-text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

export function TextAttributeField({
  attr,
  value,
  onChange,
  locked,
  lockDisabled,
  onToggleLock,
  edited,
  readOnly,
  readOnlyReason,
  placeholder,
}: {
  attr: StyleAttributeKey;
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
  lockDisabled?: boolean;
  onToggleLock: () => void;
  edited: boolean;
  readOnly: boolean;
  readOnlyReason?: string | null;
  placeholder?: string;
}) {
  const id = `style-${attr}`;
  return (
    <FieldShell attr={attr} htmlFor={id} locked={locked} lockDisabled={lockDisabled} onToggleLock={onToggleLock} edited={edited} readOnlyReason={readOnlyReason}>
      <Textarea
        id={id}
        value={value}
        readOnly={readOnly}
        aria-readonly={readOnly}
        maxLength={4000}
        placeholder={readOnly ? "Not set" : placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "min-h-[38px] resize-none px-3 py-2 text-[13px] leading-relaxed md:text-[13px]",
          readOnly && "cursor-default border-dashed bg-transparent text-text-secondary focus-visible:ring-0 dark:bg-transparent",
          edited && !readOnly && "border-info/40",
        )}
      />
    </FieldShell>
  );
}

export function ListAttributeField({
  attr,
  values,
  onChange,
  locked,
  lockDisabled,
  onToggleLock,
  edited,
  readOnly,
  readOnlyReason,
  placeholder,
  max,
  hint,
}: {
  attr: StyleAttributeKey;
  values: string[];
  onChange: (v: string[]) => void;
  locked: boolean;
  lockDisabled?: boolean;
  onToggleLock: () => void;
  edited: boolean;
  readOnly: boolean;
  readOnlyReason?: string | null;
  placeholder?: string;
  max: number;
  hint?: string;
}) {
  const id = `style-${attr}`;
  return (
    <FieldShell
      attr={attr}
      htmlFor={id}
      locked={locked}
      lockDisabled={lockDisabled}
      onToggleLock={onToggleLock}
      edited={edited}
      readOnlyReason={readOnlyReason}
      hint={hint}
    >
      <TagEditor id={id} values={values} onChange={onChange} readOnly={readOnly} placeholder={placeholder} max={max} edited={edited} />
    </FieldShell>
  );
}

/** Chips with an inline input. Enter or comma adds; Backspace on an empty input removes the last chip. */
export function TagEditor({
  id,
  values,
  onChange,
  readOnly,
  placeholder,
  max,
  edited,
}: {
  id: string;
  values: string[];
  onChange: (v: string[]) => void;
  readOnly?: boolean;
  placeholder?: string;
  max: number;
  edited?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const full = values.length >= max;

  const add = (raw: string) => {
    const items = raw
      .split(/[,\n]/)
      .map((s) => s.trim().slice(0, 200))
      .filter(Boolean);
    if (!items.length) return;
    const lower = new Set(values.map((v) => v.toLowerCase()));
    const next = [...values];
    for (const it of items) {
      if (next.length >= max) break;
      if (!lower.has(it.toLowerCase())) {
        next.push(it);
        lower.add(it.toLowerCase());
      }
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border border-input px-1.5 py-1.5 transition-colors",
        readOnly ? "border-dashed" : "cursor-text focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        edited && !readOnly && "border-info/40",
      )}
    >
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className={cn(
            "inline-flex h-6 max-w-full items-center gap-1 rounded-sm border border-border bg-elevated pr-1 pl-2 text-[12px]",
            readOnly ? "pr-2 text-text-secondary" : "text-foreground",
          )}
        >
          <span className="truncate">{v}</span>
          {!readOnly ? (
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(values.filter((_, j) => j !== i));
              }}
              className="inline-flex size-4 items-center justify-center rounded-sm text-text-muted hover:bg-interactive hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      ))}
      {readOnly ? (
        !values.length ? <span className="px-1.5 text-[12.5px] text-text-muted">None</span> : null
      ) : (
        <input
          ref={inputRef}
          id={id}
          value={draft}
          disabled={full}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,\n]/.test(v)) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,\n]/.test(text)) {
              e.preventDefault();
              add(`${draft},${text}`);
            }
          }}
          placeholder={full ? `Limit of ${max} reached` : values.length ? "Add another" : placeholder}
          className="h-6 min-w-[140px] flex-1 bg-transparent px-1.5 text-[12.5px] text-foreground outline-none placeholder:text-text-muted"
        />
      )}
    </div>
  );
}
