"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { defaultFilter } from "cmdk";
import { toast } from "sonner";
import {
  ClipboardCopy,
  Dna,
  Expand,
  LayoutGrid,
  PanelRight,
  Plus,
  Search,
  Shuffle,
  Sparkles,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useResource } from "@/lib/client/resource";
import type { CollectionSummary } from "@/lib/services/collections";
import { useApp, useProfiles } from "@/stores/app";
import { hasCommand, runCommand, useUi } from "@/stores/ui";
import { NAV } from "./nav";

export function CommandPalette() {
  const router = useRouter();
  const open = useUi((s) => s.commandOpen);
  const setOpen = useUi((s) => s.setCommandOpen);
  const profiles = useProfiles();
  const prefs = useApp((s) => s.data?.preferences);
  const updatePreferences = useApp((s) => s.updatePreferences);
  const [query, setQuery] = React.useState("");
  const { data: collections } = useResource<{ collections: CollectionSummary[] }>(open ? "/api/collections" : null);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  /** Run a page command, navigating to the Studio first when needed. */
  const studio = (cmd: string) => {
    setOpen(false);
    if (hasCommand(cmd)) runCommand(cmd);
    else router.push(`/studio?command=${cmd}`);
  };

  return (
    <CommandDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }} title="Command palette" description="Search commands and destinations" className="sm:max-w-lg">
      <Command
        className="rounded-none! bg-transparent"
        // Free-text archive search is a fallback: rank it below every real command.
        filter={(value, search, keywords) => (value.startsWith("search archive for") ? 0.0001 : defaultFilter(value, search, keywords))}
      >
      <CommandInput placeholder="Type a command or search…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        <CommandGroup heading="Studio">
          <CommandItem onSelect={() => studio("new-scene")}>
            <Plus /> New scene
          </CommandItem>
          <CommandItem onSelect={() => studio("generate")}>
            <Sparkles /> Generate image <CommandShortcut>⌘↵</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => studio("randomize")}>
            <Shuffle /> Randomize scene <CommandShortcut>R</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => studio("copy-prompt")}>
            <ClipboardCopy /> Copy prompt
          </CommandItem>
          <CommandItem onSelect={() => studio("toggle-fullscreen")}>
            <Expand /> Toggle fullscreen <CommandShortcut>⇧F</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => studio("toggle-inspector")}>
            <PanelRight /> Toggle inspector <CommandShortcut>I</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {NAV.map((n) => (
            <CommandItem key={n.href} onSelect={() => go(n.href)} value={`go ${n.label} ${n.description}`}>
              <n.icon /> {n.label}
              <CommandShortcut>{n.shortcut}</CommandShortcut>
            </CommandItem>
          ))}
          {query.trim() ? (
            <CommandItem value={`search archive for ${query}`} onSelect={() => go(`/archive?q=${encodeURIComponent(query.trim())}`)}>
              <Search /> Search archive for “{query.trim()}”
            </CommandItem>
          ) : (
            <CommandItem onSelect={() => go("/archive")}>
              <Search /> Search archive
            </CommandItem>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Switch style profile">
          {profiles
            .filter((p) => !p.archived)
            .map((p) => (
              <CommandItem
                key={p.id}
                value={`style ${p.name}`}
                onSelect={async () => {
                  setOpen(false);
                  await updatePreferences({ activeStyleProfileId: p.id });
                  runCommand("style-changed");
                  toast.success(`Active Style DNA: ${p.name}`);
                }}
              >
                <Dna /> {p.name}
                {prefs?.activeStyleProfileId === p.id ? <CommandShortcut>Active</CommandShortcut> : null}
              </CommandItem>
            ))}
        </CommandGroup>
        {collections?.collections.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Open collection">
              {collections.collections.map((c) => (
                <CommandItem key={c.id} value={`collection ${c.name}`} onSelect={() => go(`/collections/${c.id}`)}>
                  <LayoutGrid /> {c.name}
                  <CommandShortcut>{c.imageCount}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
