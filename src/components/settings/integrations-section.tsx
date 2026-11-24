"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Loader2, PlugZap, TriangleAlert } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { useApp, useRuntime } from "@/stores/app";
import { cn } from "@/lib/utils";
import { MetaLabel } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "./controls";

type TestResult = { ok: boolean; message: string; imageModels?: string[] };

const ENV_VARS: { name: string; purpose: string; group: "OpenAI" | "Supabase" }[] = [
  { name: "OPENAI_API_KEY", purpose: "Enables live image generation, AI concepts, prompt refinement and reviews.", group: "OpenAI" },
  { name: "OPENAI_IMAGE_MODEL", purpose: "Optional. Overrides the default image model.", group: "OpenAI" },
  { name: "OPENAI_TEXT_MODEL", purpose: "Optional. Overrides the default text model.", group: "OpenAI" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", purpose: "Your Supabase project URL. Together with the key below, switches Elsewhere to Supabase.", group: "Supabase" },
  { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", purpose: "Your Supabase publishable key. Safe for the browser; access is enforced by row level security.", group: "Supabase" },
];

function ModeCard({ active, title, children }: { active: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-md border px-4 py-3.5", active ? "border-text-muted bg-elevated" : "border-border bg-surface")} aria-current={active ? "true" : undefined}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-foreground">{title}</span>
        {active ? (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-success">
            <Check className="size-3" /> In use
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 text-[12px] leading-relaxed text-text-muted">{children}</div>
    </div>
  );
}

export function IntegrationsSection() {
  const runtime = useRuntime();
  const textModel = useApp((s) => s.data?.textAssist.model);
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<TestResult | null>(null);
  const configured = !!runtime?.openaiConfigured;

  async function test() {
    setTesting(true);
    try {
      const r = await api<TestResult>("/api/settings/test-provider", { method: "POST" });
      setResult(r);
      if (r.ok) toast.success("OpenAI connection works", { description: r.message });
      else toast.error("OpenAI connection failed", { description: r.message });
    } catch (err) {
      const message = errorMessage(err);
      setResult({ ok: false, message });
      toast.error("Could not test the connection", { description: message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <SettingsSection
      id="integrations"
      title="Integrations"
      description="Where your work is stored and which providers can generate. These are set by the server's environment, not from this page."
    >
      <div className="space-y-3 border-b border-border py-5">
        <MetaLabel>Data mode</MetaLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard active={runtime?.dataMode === "local"} title="Local development">
            Records and image files are kept on the server&apos;s own disk. Single user, no sign-in. Ideal for running Elsewhere on your own machine.
          </ModeCard>
          <ModeCard active={runtime?.dataMode === "supabase"} title="Supabase">
            Records live in Postgres and images in Supabase Storage, with sign-in and row level security. Used automatically when both Supabase variables are set.
          </ModeCard>
        </div>
        {runtime?.ephemeralStorageWarning ? (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-[12px] text-text-secondary">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
            This deployment uses local storage on a serverless host. Files can disappear between requests. Configure Supabase for persistent storage.
          </div>
        ) : null}
      </div>

      <div className="space-y-3 border-b border-border py-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-foreground">OpenAI</span>
              <span className={cn("inline-flex items-center gap-1.5 text-[11.5px]", configured ? "text-success" : "text-text-muted")}>
                <span className={cn("size-1.5 rounded-full", configured ? "bg-success" : "bg-text-muted/50")} aria-hidden />
                {configured ? "Configured" : "Not configured"}
              </span>
            </div>
            <p className="mt-1 max-w-lg text-[12px] leading-relaxed text-text-muted">
              {configured
                ? `Live image generation is available. Text features use ${textModel ?? "the default text model"}.`
                : runtime?.devProviderEnabled
                  ? "Without a key, the development sketch provider renders labelled composition studies instead of images, and AI text features are off."
                  : "Without a key, image generation and AI text features are unavailable."}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void test()} disabled={testing}>
            {testing ? <Loader2 className="animate-spin" /> : <PlugZap />}
            Test connection
          </Button>
        </div>
        {result ? (
          <div
            role="status"
            className={cn(
              "rounded-md border px-3 py-2.5 text-[12px]",
              result.ok ? "border-success/30 bg-success/5 text-text-secondary" : "border-danger/30 bg-danger/5 text-text-secondary",
            )}
          >
            <span className={result.ok ? "text-success" : "text-danger"}>{result.ok ? "Connected." : "Not connected."}</span> {result.message.replace(/^Connected\.\s*/, "")}
            {result.imageModels?.length ? <div className="mt-1.5 font-mono text-[11px] text-text-muted">{result.imageModels.join(", ")}</div> : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-3 py-5">
        <MetaLabel>Setup</MetaLabel>
        <p className="max-w-xl text-[12.5px] leading-relaxed text-text-secondary">
          Add these variables to <span className="font-mono text-[12px]">.env.local</span> when running locally, or to your host&apos;s environment settings, then restart
          the server. Keys live only on the server. Elsewhere never displays them and never asks for them here.
        </p>
        <div className="overflow-hidden rounded-md border border-border">
          {ENV_VARS.map((v) => (
            <div key={v.name} className="grid grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-4 border-b border-border px-3.5 py-2.5 last:border-b-0">
              <div className="min-w-0">
                <code className="font-mono text-[11.5px] break-all text-foreground">{v.name}</code>
                <div className="text-[10.5px] text-text-muted">{v.group}</div>
              </div>
              <div className="text-[12px] leading-relaxed text-text-muted">{v.purpose}</div>
            </div>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}
