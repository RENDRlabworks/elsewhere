"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { defaultFilter } from "cmdk";
import { toast } from "sonner";
import {
  ClipboardCopy,
  Dna,
  Expand,
  Inbox,
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
import { assetSrc } from "@/lib/client/api";
import type { Generation } from "@/lib/domain/schemas";
import type { CollectionSummary } from "@/lib/services/collections";
import { useApp, useProfiles } from "@/stores/app";
import { hasCommand, runCommand, useUi } from "@/stores/ui";
import { NAV } from "./nav";
import { useCapture } from "@/components/inbox/capture";

export function CommandPalette() {
  const router = useRouter();
  const open = useUi((s) => s.commandOpen);
  const setOpen = useUi((s) => s.setCommandOpen);
  const profiles = useProfiles();
  const prefs = useApp((s) => s.data?.preferences);
  const updatePreferences = useApp((s) => s.updatePreferences);
  const [query, setQuery] = React.useState("");
  const { data: collections } = useResource<{ collections: CollectionSummary[] }>(open ? "/api/collections" : null);
  // Image search waits for a pause in typing so each keystroke does not query the server.
  const [imageQuery, setImageQuery] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setImageQuery(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);
  const { data: images } = useResource<{ items: Generation[] }>(
    open && imageQuery.length >= 2 ? `/api/generations?status=completed&limit=6&q=${encodeURIComponent(imageQuery)}` : null,
  );

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
        filter={(value, search, keywords) => (value.startsWith("search library for") ? 0.0001 : value.startsWith("image ") ? 0.5 : defaultFilter(value, search, keywords))}
      >
      <CommandInput placeholder="Type a command or search…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        <CommandGroup heading="Create">
          <CommandItem onSelect={() => studio("new-scene")}>
            <Plus /> New scene
          </CommandItem>
          <CommandItem
            value="capture an idea inbox note"
            onSelect={() => {
              setOpen(false);
              useCapture.getState().show();
            }}
          >
            <Inbox /> Capture an idea <CommandShortcut>N</CommandShortcut>
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
            <PanelRight /> Show or hide details <CommandShortcut>I</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        {images?.items.length && query.trim().length >= 2 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Images">
              {images.items.map((g) => (
                <CommandItem key={g.id} value={`image ${g.id} ${g.title}`} onSelect={() => go(`/studio?generation=${g.id}`)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={assetSrc(g.assetId, "thumb") ?? ""} alt="" className="size-7 shrink-0 rounded-sm object-cover" />
                  <span className="truncate">{g.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {NAV.map((n) => (
            <CommandItem key={n.label} onSelect={() => go(n.href)} value={`go ${n.label} ${n.description}`}>
              <n.icon /> {n.label}
              <CommandShortcut>{n.shortcut}</CommandShortcut>
            </CommandItem>
          ))}
          {query.trim() ? (
            <CommandItem value={`search library for ${query}`} onSelect={() => go(`/archive?q=${encodeURIComponent(query.trim())}`)}>
              <Search /> Search the Library for “{query.trim()}”
            </CommandItem>
          ) : (
            <CommandItem onSelect={() => go("/archive")}>
              <Search /> Search the Library
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
                  toast.success(`Active look: ${p.name}`);
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
