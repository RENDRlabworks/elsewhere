import { z } from "zod";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { retryJob } from "@/lib/services/generations";

export const maxDuration = 300;

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { idempotencyKey } = await parseJson(req, z.object({ idempotencyKey: z.string().min(8).max(80) }));
  const res = await retryJob(await getContext(), id, idempotencyKey);
  return json({ job: res.job, generations: res.generations, notes: res.notes }, { status: 202 });
});
