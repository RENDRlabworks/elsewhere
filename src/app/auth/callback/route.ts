import { NextResponse } from "next/server";
import { createRequestSupabase } from "@/lib/server/supabase";

/** Completes email magic-link and OAuth sign-in by exchanging the code for a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/studio";
  if (code) {
    const supabase = await createRequestSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
