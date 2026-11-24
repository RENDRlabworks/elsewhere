import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";
import { cancelJob } from "@/lib/services/generations";

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return json({ job: await cancelJob(await getContext(), id) });
});
