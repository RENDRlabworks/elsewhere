import { styleLockSchema } from "@/lib/domain/schemas";
import { getContext } from "@/lib/server/context";
import { handle, json, parseJson } from "@/lib/server/http";
import { setStyleLocks } from "@/lib/services/styles";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await getContext();
  return json({ profile: await setStyleLocks(ctx, id, await parseJson(req, styleLockSchema)) });
});
