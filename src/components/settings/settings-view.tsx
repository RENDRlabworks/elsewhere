"use client";

import * as React from "react";
import { useResource } from "@/lib/client/resource";
import { usePreferences } from "@/stores/app";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/primitives";
import { GenerationSection } from "./generation-section";
import { IntegrationsSection } from "./integrations-section";
import { AutosaveSection, InterfaceSection } from "./interface-section";
import { LimitsSection, type SettingsPayload } from "./limits-section";
import { DataSection, ShortcutsSection } from "./reference-sections";

const NAV = [
  { id: "generation", label: "Generation" },
  { id: "limits", label: "Limits and usage" },
  { id: "integrations", label: "Integrations" },
  { id: "interface", label: "Interface" },
  { id: "autosave", label: "Autosave" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "data", label: "Storage and data" },
] as const;

export function SettingsView() {
  const prefs = usePreferences();
  const { data: payload } = useResource<SettingsPayload>("/api/settings");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<string>(NAV[0].id);

  const scrollTo = React.useCallback((id: string, smooth = true) => {
    const el = document.getElementById(id);
    const root = scrollRef.current;
    if (!el || !root) return;
    // Scroll only our container; scrollIntoView would also shift the shell's overflow-hidden ancestors.
    for (let a = root.parentElement; a; a = a.parentElement) if (a.scrollTop) a.scrollTop = 0;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 32;
    root.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
    setActive(id);
  }, []);

  // Track the section in view for the sub-navigation.
  React.useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      const top = root.getBoundingClientRect().top;
      let current: string = NAV[0].id;
      for (const n of NAV) {
        const el = document.getElementById(n.id);
        if (el && el.getBoundingClientRect().top - top <= 96) current = n.id;
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = NAV[NAV.length - 1].id;
      setActive(current);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  // Honour deep links such as /settings#integrations.
  React.useEffect(() => {
    const go = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id && NAV.some((n) => n.id === id)) requestAnimationFrame(() => scrollTo(id, false));
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [scrollTo]);

  if (!prefs) return null;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Settings" description="Defaults, limits, integrations and interface preferences. Changes save as you make them." />
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Settings sections" className="hidden w-52 shrink-0 border-r border-border px-3 py-6 md:block">
          <ul className="space-y-0.5">
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  aria-current={active === n.id ? "location" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    history.replaceState(null, "", `#${n.id}`);
                    scrollTo(n.id);
                  }}
                  className={cn(
                    "flex h-8 items-center rounded-md px-2.5 text-[12.5px] transition-colors",
                    active === n.id ? "bg-interactive text-foreground" : "text-text-secondary hover:bg-surface hover:text-foreground",
                  )}
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
          <div className="max-w-[820px] space-y-16 px-10 pt-8 pb-24">
            <GenerationSection prefs={prefs} />
            <LimitsSection prefs={prefs} payload={payload} />
            <IntegrationsSection />
            <InterfaceSection prefs={prefs} />
            <AutosaveSection prefs={prefs} />
            <ShortcutsSection />
            <DataSection payload={payload} />
          </div>
        </div>
      </div>
    </div>
  );
}
