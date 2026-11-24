"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { Option } from "@/lib/domain/vocab";
import { cn } from "@/lib/utils";
import { Field } from "@/components/common/primitives";
import type { SuggestionGroup } from "@/lib/explore/suggestions";
import { SuggestInput } from "./suggest-input";

/** Collapsible panel section with remembered open state. */
export function PanelSection({
  id,
  title,
  children,
  defaultOpen = true,
  aside,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  aside?: React.ReactNode;
}) {
  const storageKey = `elsewhere.section.${id}`;
  const [open, setOpen] = React.useState(() => {
    if (typeof window === "undefined") return defaultOpen;
    try {
      const v = localStorage.getItem(storageKey);
      return v == null ? defaultOpen : v === "1";
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(storageKey, o ? "0" : "1");
      } catch {}
      return !o;
    });
  };
  return (
    <section className="border-b border-border">
      <div className="flex h-10 items-center justify-between px-4">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex flex-1 items-center gap-1.5 text-left text-[12px] font-medium text-text-secondary hover:text-foreground"
        >
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
          {title}
        </button>
        {aside}
      </div>
      {open ? <div className="space-y-4 px-4 pt-1 pb-5">{children}</div> : null}
    </section>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  rows = 2,
  suggestions,
  locked,
  onToggleLock,
  hint,
  mono,
  trailing,
  onFocus,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  suggestions?: readonly string[] | readonly SuggestionGroup[];
  locked?: boolean;
  onToggleLock?: () => void;
  hint?: React.ReactNode;
  mono?: boolean;
  trailing?: React.ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const id = React.useId();
  return (
    <Field label={label} htmlFor={id} locked={locked} onToggleLock={onToggleLock} hint={hint} trailing={trailing}>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className={cn("min-h-0 resize-none text-[12.5px] leading-relaxed", mono && "font-mono text-[12px]")}
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
      ) : suggestions?.length ? (
        <SuggestInput id={id} value={value} onChange={onChange} suggestions={suggestions} placeholder={placeholder} onFocus={onFocus} onBlur={onBlur} />
      ) : (
        <Input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur} className="h-8 text-[12.5px]" />
      )}
    </Field>
  );
}

export function SelectField<K extends string>({
  label,
  value,
  options,
  onChange,
  locked,
  onToggleLock,
  hint,
}: {
  label: string;
  value: K;
  options: Option<K>[];
  onChange: (v: K) => void;
  locked?: boolean;
  onToggleLock?: () => void;
  hint?: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <Field label={label} htmlFor={id} locked={locked} onToggleLock={onToggleLock} hint={hint}>
      <Select value={value} onValueChange={(v) => onChange(v as K)}>
        <SelectTrigger id={id} size="sm" className="h-8 w-full text-[12.5px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  display,
  describe,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  display?: string;
  describe?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-secondary">{label}</span>
        <span className="font-mono text-[11px] text-text-muted tabular-nums">{display ?? value}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} aria-label={label} />
      {describe ? <div className="text-[11px] leading-snug text-text-muted">{describe}</div> : null}
    </div>
  );
}

/** Logarithmic mapping for subject height so tiny subjects get fine control. */
export const heightToSlider = (h: number) => Math.round((Math.log(h / 0.5) / Math.log(180)) * 1000) / 10;
export const sliderToHeight = (t: number) => {
  const h = 0.5 * 180 ** (t / 100);
  return h < 10 ? Math.round(h * 10) / 10 : Math.round(h);
};
