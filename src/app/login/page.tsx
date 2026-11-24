import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.ELSEWHERE_DATA_MODE !== "local";
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-[340px]">
        <div className="mb-10">
          <div className="text-[13px] font-medium tracking-[0.18em] uppercase">Elsewhere</div>
          <div className="mt-2 text-[13px] text-text-muted">Familiar things. Impossible worlds.</div>
        </div>
        <Suspense>
          <LoginForm configured={configured} />
        </Suspense>
      </div>
    </div>
  );
}
