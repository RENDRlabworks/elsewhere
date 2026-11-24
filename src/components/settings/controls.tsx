"use client";

import * as React from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/client/api";
import { invalidate } from "@/lib/client/resource";
import { useApp } from "@/stores/app";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Persist a partial preferences patch; the rest of the app updates through the store. */
export async function savePreferences(patch: Record<string, unknown>, message = "Settings saved") {
  try {
    await useApp.getState().updatePreferences(patch);
    invalidate("/api/settings");
    toast.success(message, { id: "settings-saved", duration: 1600 });
    return true;
  } catch (err) {
    toast.error("Could not save settings", { description: errorMessage(err) });
    return false;
  }
}

export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8">
      <h2 id={`${id}-title`} className="text-[15px] font-medium text-foreground">
        {title}
      </h2>
      {description ? <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-text-muted">{description}</p> : null}
      <div className="mt-5 border-t border-border">{children}</div>
    </section>
  );
}

/** One labelled setting: label and hint on the left, control on the right. */
export function SettingRow({
  label,
  hint,
  htmlFor,
  children,
  stacked,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={cn("border-b border-border py-4", stacked ? "space-y-3" : "grid grid-cols-[minmax(0,1fr)_minmax(0,300px)] items-start gap-8")}>
      <div className="min-w-0 pt-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-[13px] text-foreground">
            {label}
          </label>
        ) : (
          <div className="text-[13px] text-foreground">{label}</div>
        )}
        {hint ? <div className="mt-0.5 text-[12px] leading-relaxed text-text-muted">{hint}</div> : null}
      </div>
      <div className={cn("min-w-0", !stacked && "flex justify-end")}>{children}</div>
    </div>
  );
}

/** Number input that commits on blur or Enter, validates the range and reverts invalid input. */
export function NumberField({
  id,
  value,
  min,
  max,
  step = 1,
  integer = true,
  prefix,
  suffix,
  disabled,
  onCommit,
  label,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  onCommit: (v: number) => void;
  label?: string;
}) {
  const commit = (input: HTMLInputElement) => {
    const raw = input.value.trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n)) {
      input.value = String(value);
      toast.error(`Enter a number between ${min} and ${max}`);
      return;
    }
    let v = integer ? Math.round(n) : Math.round(n * 100) / 100;
    if (v < min || v > max) {
      v = Math.min(max, Math.max(min, v));
      toast.message(`Adjusted to ${v}, the allowed range is ${min} to ${max}`);
    }
    input.value = String(v);
    if (v !== value) onCommit(v);
  };
  return (
    <div className={cn("flex h-8 w-36 items-center rounded-lg border border-input dark:bg-input/30", "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50", disabled && "opacity-50")}>
      {prefix ? <span className="pl-2.5 font-mono text-[12px] text-text-muted">{prefix}</span> : null}
      <Input
        key={value}
        id={id}
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        defaultValue={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget);
          if (e.key === "Escape") e.currentTarget.value = String(value);
        }}
        className="h-full flex-1 border-0 bg-transparent px-2.5 text-right font-mono text-[12.5px] tabular-nums focus-visible:ring-0 md:text-[12.5px] dark:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix ? <span className="pr-2.5 font-mono text-[12px] text-text-muted">{suffix}</span> : null}
    </div>
  );
}

/** Segmented single choice built on native radios, so arrow keys work. */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  name: string;
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex h-8 rounded-lg border border-border bg-background p-0.5", disabled && "opacity-50")}>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "relative flex cursor-pointer items-center rounded-md px-3 text-[12px] text-text-secondary transition-colors select-none hover:text-foreground",
            "has-[:checked]:bg-interactive has-[:checked]:text-foreground has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-text-secondary",
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={disabled}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
