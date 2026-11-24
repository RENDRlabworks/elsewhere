import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";
import { countInbox } from "@/lib/services/ideas";

/** How many ideas wait in the inbox, for the navigation badge. Null until the migration has run. */
export const GET = handle(async () => {
  try {
    return json({ count: await countInbox(await getContext()) });
  } catch (err) {
    if ((err as { code?: string }).code === "migration_required") return json({ count: null });
    throw err;
  }
});
