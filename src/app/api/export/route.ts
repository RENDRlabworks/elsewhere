import { getContext } from "@/lib/server/context";
import { handle } from "@/lib/server/http";
import { exportAll } from "@/lib/services/archive";

export const GET = handle(async () => {
  const data = await exportAll(await getContext());
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="elsewhere-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
