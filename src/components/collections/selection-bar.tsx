"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";

/** Floating bar for bulk actions on a selection. Shared by collections and the archive. */
export function SelectionBar({
  count,
  onClear,
  children,
  className,
}: {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.16 }}
          role="toolbar"
          aria-label={`${count} selected`}
          className={cn(
            "absolute bottom-6 left-1/2 z-30 flex h-11 -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-elevated pr-1.5 pl-3 shadow-lg shadow-black/40",
            className,
          )}
        >
          <span className="mr-2 font-mono text-[12px] whitespace-nowrap text-foreground tabular-nums">{count} selected</span>
          <span className="mr-1 h-5 w-px bg-border" aria-hidden />
          {children}
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Clear selection" className="text-text-secondary">
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2">
              Clear selection <Kbd>Esc</Kbd>
            </TooltipContent>
          </Tooltip>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function BarButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button size="sm" variant="ghost" className={cn("text-[12.5px] text-text-secondary hover:text-foreground", className)} {...props} />;
}
