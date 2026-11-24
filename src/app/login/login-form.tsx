"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeSupabaseUrl } from "@/lib/supabase-url";

function supabase() {
  return createBrowserClient(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

export function LoginForm({ configured }: { configured: boolean }) {
  const params = useSearchParams();
  const next = params.get("next") ?? "/studio";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState<"password" | "magic" | "signup">("password");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: "error" | "info"; text: string } | null>(
    params.get("error") ? { kind: "error", text: "That sign-in link is invalid or has expired." } : null,
  );

  if (!configured) {
    return (
      <div className="space-y-4 text-[13px]">
        <p className="text-text-secondary">
          Elsewhere is running in local development mode. Everything is stored on this machine and no sign-in is required.
        </p>
        <Button asChild className="w-full">
          <Link href="/studio">Open the Studio</Link>
        </Button>
        <p className="text-[12px] text-text-muted">Configure Supabase to enable accounts. See the README.</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const client = supabase();
    const redirect = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    try {
      if (mode === "magic") {
        const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        setMessage({ kind: "info", text: "Check your email for a sign-in link." });
      } else if (mode === "signup") {
        const { error, data } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        if (data.session) location.href = next;
        else setMessage({ kind: "info", text: "Check your email to confirm your account." });
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.href = next;
      }
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Sign-in failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[12px] text-text-secondary">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {mode !== "magic" ? (
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[12px] text-text-secondary">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      ) : null}
      {message ? (
        <p role="status" className={message.kind === "error" ? "text-[12.5px] text-danger" : "text-[12.5px] text-text-secondary"}>
          {message.text}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <LoaderCircle className="animate-spin" /> : null}
        {mode === "magic" ? "Email me a link" : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
      <div className="flex justify-between text-[12px] text-text-muted">
        <button type="button" className="hover:text-text-secondary" onClick={() => setMode(mode === "magic" ? "password" : "magic")}>
          {mode === "magic" ? "Use a password" : "Use a magic link"}
        </button>
        <button type="button" className="hover:text-text-secondary" onClick={() => setMode(mode === "signup" ? "password" : "signup")}>
          {mode === "signup" ? "I have an account" : "Create an account"}
        </button>
      </div>
    </form>
  );
}
