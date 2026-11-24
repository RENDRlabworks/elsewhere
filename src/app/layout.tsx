import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Elsewhere", template: "%s · Elsewhere" },
  description: "Familiar things. Impossible worlds. A personal studio for directing AI fine-art imagery.",
};

export const viewport: Viewport = { themeColor: "#060607", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable} h-full`}>
      <body className="h-full overflow-hidden">
        <TooltipProvider delayDuration={350}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
