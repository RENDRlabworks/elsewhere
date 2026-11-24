"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * A text input with a suggestion menu. Unlike a native datalist, the menu always
 * opens with every suggestion (from the chevron, ArrowDown or Alt+ArrowDown) even
 * when the field already has text; typing filters it.
 */
export function SuggestInput({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  onFocus,
  onBlur,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: readonly string[];
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  // null shows every suggestion; a string filters by what the person typed.
  const [filter, setFilter] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(-1);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = `${id}-suggestions`;

  const items = React.useMemo(() => {
    const q = filter?.trim().toLowerCase();
    return q ? suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q) : [...suggestions];
  }, [filter, suggestions]);

  const visible = open && items.length > 0;

  const show = (all: boolean) => {
    setFilter(all ? null : value);
    setActive(-1);
    setOpen(true);
  };
  const choose = (s: string) => {
    onChange(s);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!visible) return show(true);
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp" && visible) {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && visible && active >= 0 && items[active]) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape" && visible) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  // Keep the highlighted option in view while moving with the keyboard.
  React.useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  return (
    <PopoverPrimitive.Root open={visible} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={wrapRef} className="relative">
          <Input
            ref={inputRef}
            id={id}
            value={value}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={visible}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            onChange={(e) => {
              onChange(e.target.value);
              setFilter(e.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={() => {
              setOpen(false);
              onBlur?.();
            }}
            className="h-8 pr-7 text-[12.5px]"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Show suggestions"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (visible) setOpen(false);
              else {
                inputRef.current?.focus();
                show(true);
              }
            }}
            className="absolute inset-y-0 right-0 flex w-7 items-center justify-center text-text-muted hover:text-foreground"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", visible && "rotate-180")} />
          </button>
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (wrapRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
          className="z-50 max-h-64 w-(--radix-popover-trigger-width) min-w-56 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div id={listId} role="listbox" aria-label="Suggestions">
            {items.map((s, i) => {
              const current = s.toLowerCase() === value.trim().toLowerCase();
              return (
                <div
                  key={s}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-[12.5px] text-text-secondary",
                    i === active && "bg-interactive text-foreground",
                  )}
                >
                  <span>{s}</span>
                  {current ? <Check className="size-3 shrink-0 text-text-muted" /> : null}
                </div>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
