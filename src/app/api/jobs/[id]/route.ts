import { getContext } from "@/lib/server/context";
import { handle, json, notFound } from "@/lib/server/http";
import { sweepStaleJobs } from "@/lib/services/generations";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getContext();
  await sweepStaleJobs(ctx);
  const job = await ctx.db.table("generation_jobs").get(id);
  if (!job) throw notFound("Job");
  const generations = await ctx.db.table("generations").list({ where: { jobId: id }, order: [{ field: "variationIndex" }] });
  // Never expose stored request internals beyond what the UI needs.
  const { request: _r, ...publicJob } = job;
  void _r;
  return json({ job: publicJob, generations });
});
