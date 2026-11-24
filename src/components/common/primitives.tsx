"use client";

import * as React from "react";
import Link from "next/link";
import { Lock, LockOpen, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/** Restrained uppercase metadata label. */
export function MetaLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("label-meta", className)}>{children}</div>;
}

/**
 * Page title, optional tabs and actions. No explainer paragraph: pages speak through
 * their content, and help lives in empty states. `description` is accepted for
 * screen readers only.
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  tabs,
  editorial,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  tabs?: React.ReactNode;
  editorial?: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 px-4 pt-5 pb-4 md:flex-row md:items-end md:justify-between md:gap-6 md:px-8 md:pt-8 md:pb-5">
      <div className="min-w-0">
        {meta ? <div className="mb-3">{meta}</div> : null}
        <h1 className={cn("truncate text-foreground", editorial ? "text-editorial text-[28px] leading-9" : "text-[24px] leading-8 font-medium tracking-[-0.01em]")}>{title}</h1>
        {description ? <p className="sr-only">{description}</p> : null}
        {tabs ? <div className="mt-4">{tabs}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Underlined text tabs that navigate between pages. */
export function PageTabs({ items }: { items: { href: string; label: string; active: boolean; count?: number | null }[] }) {
  return (
    <nav className="flex gap-6" aria-label="Sections">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px border-b pb-2 text-[14px] transition-colors",
            t.active ? "border-foreground text-foreground" : "border-transparent text-text-muted hover:text-text-secondary",
          )}
        >
          {t.label}
          {t.count != null ? <span className="ml-1.5 font-mono text-[11.5px] text-text-muted tabular-nums">{t.count.toLocaleString()}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {Icon ? <Icon className="mb-4 size-5 text-text-muted" strokeWidth={1.5} /> : null}
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      {description ? <div className="mt-1 max-w-sm text-[12.5px] text-text-muted">{description}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function IconButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  active,
  disabled,
  className,
  size = "icon-sm",
  side = "bottom",
  ...rest
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "icon-xs" | "icon-sm" | "icon";
  side?: "top" | "bottom" | "left" | "right";
} & Omit<React.ComponentProps<"button">, "onClick">) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={size}
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={cn("text-text-secondary hover:text-foreground", active && "bg-interactive text-foreground", className)}
          {...rest}
        >
          <Icon strokeWidth={1.75} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side} className="flex items-center gap-2">
        {label}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
  locked,
  onToggleLock,
  trailing,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  htmlFor?: string;
  locked?: boolean;
  onToggleLock?: () => void;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-4 items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[12px] text-text-secondary">
          {label}
        </label>
        <div className="flex items-center gap-1">
          {trailing}
          {onToggleLock ? <LockToggle locked={!!locked} onToggle={onToggleLock} label={label} /> : null}
        </div>
      </div>
      {children}
      {hint ? <div className="text-[11.5px] text-text-muted">{hint}</div> : null}
    </div>
  );
}

export function LockToggle({ locked, onToggle, label, disabled }: { locked: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={onToggle}
          aria-pressed={locked}
          aria-label={`${locked ? "Unlock" : "Lock"} ${label}`}
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-sm transition-colors disabled:opacity-40",
            locked ? "text-warning" : "text-text-muted/60 hover:text-text-secondary",
          )}
        >
          {locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{locked ? `Locked: ${label}` : `Lock ${label}`}</TooltipContent>
    </Tooltip>
  );
}

export function SwatchStrip({ hexes, className, size = "md" }: { hexes: string[]; className?: string; size?: "sm" | "md" }) {
  if (!hexes.length) return null;
  return (
    <div className={cn("flex overflow-hidden rounded-sm border border-border", size === "sm" ? "h-2.5" : "h-4", className)}>
      {hexes.map((h, i) => (
        <div key={`${h}-${i}`} className="flex-1" style={{ background: h }} title={h} />
      ))}
    </div>
  );
}

export function Section({
  title,
  children,
  actions,
  className,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <MetaLabel>{title}</MetaLabel>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3">
      <MetaLabel>{label}</MetaLabel>
      <div className="mt-1 font-mono text-[15px] text-foreground tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-[11.5px] text-text-muted">{hint}</div> : null}
    </div>
  );
}
