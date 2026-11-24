"use client";

import * as React from "react";
import { create } from "zustand";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type State = { open: boolean; opts: ConfirmOptions | null; resolve: ((v: boolean) => void) | null };

const useConfirmStore = create<State>(() => ({ open: false, opts: null, resolve: null }));

/** Promise-based confirmation for destructive or costly operations. */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ open: true, opts, resolve }));
}

export function ConfirmHost() {
  const { open, opts, resolve } = useConfirmStore();
  const close = (v: boolean) => {
    resolve?.(v);
    useConfirmStore.setState({ open: false, resolve: null });
  };
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[14px] font-medium">{opts?.title}</AlertDialogTitle>
          {opts?.description ? <AlertDialogDescription className="text-[12.5px]">{opts.description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{opts?.cancelLabel ?? "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={opts?.destructive ? "bg-danger text-white hover:bg-danger/85" : undefined}
          >
            {opts?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
