import { Archive, Compass, Dna, LayoutGrid, Settings, SquarePen, type LucideIcon } from "lucide-react";

export const NAV: { href: string; label: string; icon: LucideIcon; shortcut: string; description: string }[] = [
  { href: "/studio", label: "Studio", icon: SquarePen, shortcut: "G S", description: "Direct and generate scenes" },
  { href: "/explore", label: "Explore", icon: Compass, shortcut: "G E", description: "Discover unexpected concepts" },
  { href: "/style-dna", label: "Style DNA", icon: Dna, shortcut: "G D", description: "Visual identities and references" },
  { href: "/collections", label: "Collections", icon: LayoutGrid, shortcut: "G C", description: "Curated visual series" },
  { href: "/archive", label: "Archive", icon: Archive, shortcut: "G A", description: "Every generation and its history" },
  { href: "/settings", label: "Settings", icon: Settings, shortcut: "G ,", description: "Preferences, limits and integrations" },
];
