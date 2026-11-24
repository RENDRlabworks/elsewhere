"use client";

import * as React from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { MetaLabel } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "./controls";
import type { SettingsPayload } from "./limits-section";

const noop = () => () => {};
function useIsMac() {
  return React.useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => true,
  );
}

type Shortcut = { keys: string[][]; label: string };

function shortcutGroups(mod: string): { title: string; items: Shortcut[] }[] {
  return [
    {
      title: "Everywhere",
      items: [
        { keys: [[mod, "K"]], label: "Open the command palette" },
        { keys: [["G", "S"]], label: "Go to Studio" },
        { keys: [["G", "E"]], label: "Go to Explore" },
        { keys: [["G", "D"]], label: "Go to Style DNA" },
        { keys: [["G", "C"]], label: "Go to Collections" },
        { keys: [["G", "A"]], label: "Go to Archive" },
        { keys: [["G", ","]], label: "Go to Settings" },
      ],
    },
    {
      title: "Studio",
      items: [
        { keys: [[mod, "Enter"]], label: "Generate" },
        { keys: [["R"]], label: "Randomize scene" },
        { keys: [["F"]], label: "Favorite image" },
        { keys: [["A"]], label: "Accept image" },
        { keys: [["X"]], label: "Reject image" },
        { keys: [["V"]], label: "Create a variation" },
        { keys: [["I"]], label: "Toggle the inspector" },
        { keys: [["Shift", "F"]], label: "Toggle fullscreen" },
        { keys: [["["], ["]"]], label: "Previous or next image" },
        { keys: [["0"]], label: "Fit image to view" },
        { keys: [["1"]], label: "Actual size" },
        { keys: [["C"]], label: "Compare images" },
      ],
    },
    {
      title: "Explore",
      items: [
        { keys: [["R"]], label: "Randomize unlocked variables" },
        { keys: [["Shift", "R"]], label: "Randomize everything" },
        { keys: [["S"]], label: "Surprise me" },
      ],
    },
    {
      title: "Style DNA",
      items: [{ keys: [[mod, "S"]], label: "Save profile changes" }],
    },
  ];
}

function Keys({ combos }: { combos: string[][] }) {
  return (
    <span className="flex items-center gap-1.5">
      {combos.map((combo, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <span className="text-[11px] text-text-muted">or</span> : null}
          <span className="flex items-center gap-1">
            {combo.map((k, j) => (
              <React.Fragment key={k}>
                {j > 0 && combo[0] === "G" ? <span className="text-[10.5px] text-text-muted">then</span> : null}
                <Kbd className="min-w-6 font-mono text-[11px]">{k}</Kbd>
              </React.Fragment>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

export function ShortcutsSection() {
  const mac = useIsMac();
  const groups = shortcutGroups(mac ? "⌘" : "Ctrl");
  return (
    <SettingsSection id="shortcuts" title="Keyboard shortcuts" description="Single-key shortcuts are ignored while you type in a field.">
      <div className="grid gap-x-10 gap-y-6 py-5 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title} className={cn(g.title === "Studio" && "md:row-span-2")}>
            <MetaLabel className="mb-2">{g.title}</MetaLabel>
            <dl className="divide-y divide-border border-y border-border">
              {g.items.map((s) => (
                <div key={s.label} className="flex h-9 items-center justify-between gap-4">
                  <dt className="text-[12.5px] text-text-secondary">{s.label}</dt>
                  <dd>
                    <Keys combos={s.keys} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

export function DataSection({ payload }: { payload: SettingsPayload | undefined }) {
  const s = payload?.storage;
  const rows = s
    ? [
        { label: "Generated images", ...s.generations },
        { label: "Reference images", ...s.references },
        { label: "Imported images", ...s.imports },
      ]
    : [];
  return (
    <SettingsSection id="data" title="Storage and data" description="Everything Elsewhere stores for you, and a way to take it with you.">
      <div className="space-y-3 border-b border-border py-5">
        <div className="flex items-baseline justify-between">
          <MetaLabel>Storage</MetaLabel>
          {s ? (
            <span className="font-mono text-[12px] text-text-secondary tabular-nums">
              {formatBytes(s.bytes)} in {s.files.toLocaleString()} file{s.files === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        {s ? (
          <div className="space-y-2.5">
            {rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[160px_minmax(0,1fr)_150px] items-center gap-4">
                <span className="text-[12.5px] text-text-secondary">{r.label}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-interactive" aria-hidden>
                  <div className="h-full rounded-full bg-text-secondary" style={{ width: `${s.bytes ? Math.max(r.bytes ? 1 : 0, (r.bytes / s.bytes) * 100) : 0}%` }} />
                </div>
                <span className="text-right font-mono text-[11.5px] text-text-muted tabular-nums">
                  {formatBytes(r.bytes)} · {r.files.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Skeleton className="h-20" />
        )}
      </div>
      <div className="flex items-start justify-between gap-6 border-b border-border py-5">
        <div>
          <div className="text-[13px] text-foreground">Export all data</div>
          <p className="mt-0.5 max-w-md text-[12px] leading-relaxed text-text-muted">
            A JSON file with every scene, Style DNA version, generation record, collection and usage record. Image files are referenced by asset ID.
          </p>
        </div>
        <Button asChild size="sm" variant="secondary">
          <a href="/api/export" download>
            <Download /> Export JSON
          </a>
        </Button>
      </div>
      <div className="py-5 text-[12px] leading-relaxed text-text-muted">
        Permanent deletion happens one image at a time in the{" "}
        <Link href="/archive" className="text-text-secondary underline underline-offset-2 hover:text-foreground">
          Archive
        </Link>
        , and always asks for confirmation. Rejecting an image never deletes it.
      </div>
    </SettingsSection>
  );
}
