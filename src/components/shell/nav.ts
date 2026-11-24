import { Archive, Compass, Dna, LayoutGrid, Settings, Sparkles, SquarePen, type LucideIcon } from "lucide-react";

export type Destination = { href: string; label: string; icon: LucideIcon; shortcut: string; description: string; match?: string[] };

/** The two places in the sidebar. Everything else is reached from inside them. */
export const PRIMARY_NAV: Destination[] = [
  { href: "/studio", label: "Create", icon: Sparkles, shortcut: "G C", description: "Make new images from a starting image", match: ["/studio", "/explore", "/style-dna"] },
  { href: "/archive", label: "Library", icon: LayoutGrid, shortcut: "G L", description: "Every image and collection", match: ["/archive", "/collections"] },
];

/** Every destination, for the command palette. */
export const NAV: Destination[] = [
  ...PRIMARY_NAV,
  { href: "/collections", label: "Collections", icon: LayoutGrid, shortcut: "", description: "Curated visual series" },
  { href: "/explore", label: "Ideas", icon: Compass, shortcut: "G E", description: "Shuffle scene concepts without generating" },
  { href: "/style-dna", label: "Looks", icon: Dna, shortcut: "G D", description: "The looks you generate in" },
  { href: "/archive", label: "All images", icon: Archive, shortcut: "G A", description: "Search your full history" },
  { href: "/settings", label: "Settings", icon: Settings, shortcut: "G ,", description: "Preferences, limits and integrations" },
  { href: "/studio", label: "Studio", icon: SquarePen, shortcut: "G S", description: "The Create workspace" },
];

export const isActive = (d: Destination, pathname: string) =>
  (d.match ?? [d.href]).some((m) => pathname === m || pathname.startsWith(`${m}/`));
