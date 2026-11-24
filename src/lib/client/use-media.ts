"use client";

import { useSyncExternalStore } from "react";

/** Live result of a CSS media query. False during server rendering. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Phone-sized screens, matching Tailwind's `md` breakpoint. */
export const useIsPhone = () => useMediaQuery("(max-width: 767px)");
