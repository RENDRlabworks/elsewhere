import { z } from "zod";
import { getContext } from "@/lib/server/context";
import { streamBytes } from "@/lib/server/stream";
import { handle, parseJson } from "@/lib/server/http";
import { zipGenerations } from "@/lib/services/collections";
import { exportOptionsSchema } from "@/lib/services/share";

export const maxDuration = 120;

export const POST = handle(async (req: Request) => {
  const ctx = await getContext();
  const { ids, export: opts } = await parseJson(req, z.object({ ids: z.array(z.string()).min(1).max(200), export: exportOptionsSchema.nullable().default(null) }));
  const gens = await ctx.db.table("generations").list({ where: { id: { in: ids } } });
  const ordered = ids.map((id) => gens.find((g) => g.id === id)).filter((g) => !!g);
  const zip = await zipGenerations(ctx, ordered, opts);
  return new Response(streamBytes(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="elsewhere-${new Date().toISOString().slice(0, 10)}.zip"`,
    },
  });
});
