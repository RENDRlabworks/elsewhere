import "server-only";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type z } from "zod";
import { NotFoundError } from "@/lib/data/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, "bad_request", details);
export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`, "not_found");
export const conflict = (msg: string, code = "conflict", details?: unknown) => new HttpError(409, msg, code, details);

/** Never leak secrets: strip anything that looks like an API key from messages. */
export function redact(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***")
    .replace(/sb_(secret|publishable)_[A-Za-z0-9_-]+/g, "sb_***")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***");
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: { message: err.message, code: err.code ?? "error", details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { message: "Invalid request", code: "validation", details: err.issues.slice(0, 20) } },
      { status: 400 },
    );
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: { message: err.message, code: "not_found" } }, { status: 404 });
  }
  const message = redact(err instanceof Error ? err.message : String(err));
  console.error("[elsewhere] unhandled error:", message);
  return NextResponse.json({ error: { message: "Something went wrong. " + message, code: "internal" } }, { status: 500 });
}

/** Wrap a route handler with consistent error handling. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      // Let Next.js control-flow signals (prerender bail-outs, redirects) propagate.
      unstable_rethrow(err);
      return errorResponse(err);
    }
  };
}

export async function parseJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Expected a JSON body");
  }
  return schema.parse(body);
}

export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  return schema.parse(obj);
}

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);
