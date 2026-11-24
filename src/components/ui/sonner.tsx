"use client";

import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        info: <Info className="size-4 text-text-secondary" />,
        warning: <TriangleAlert className="size-4 text-warning" />,
        error: <OctagonX className="size-4 text-danger" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!bg-elevated !border-border !text-foreground !rounded-md !shadow-none !text-[13px]",
          description: "!text-text-secondary",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-interactive !text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
