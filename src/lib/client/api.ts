"use client";

/** Typed client for Elsewhere's route handlers. All secrets stay server-side. */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Init = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal };

export async function api<T>(path: string, init: Init = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method: init.method ?? (body ? "POST" : "GET"), headers, body, signal: init.signal, cache: "no-store" });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("Network error. Check your connection and try again.", 0, "network");
  }
  if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
    location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
  }
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const e = (data as { error?: { message?: string; code?: string; details?: unknown } } | null)?.error;
    throw new ApiError(e?.message ?? `Request failed (${res.status})`, res.status, e?.code ?? "error", e?.details);
  }
  return data as T;
}

export const assetSrc = (assetId: string | null | undefined, variant: "thumb" | "full" = "thumb") =>
  assetId ? `/api/assets/${assetId}${variant === "thumb" ? "?variant=thumb" : ""}` : null;

export const assetDownload = (assetId: string, filename?: string) =>
  `/api/assets/${assetId}?download=1${filename ? `&filename=${encodeURIComponent(filename)}` : ""}`;

export function newIdempotencyKey() {
  return `${Date.now().toString(36)}-${crypto.randomUUID()}`;
}

/** Trigger a browser download for a POST that returns a file. */
export async function downloadPost(path: string, body: unknown, filename: string) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new ApiError("Download failed", res.status, "download");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
