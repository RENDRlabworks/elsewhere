import { dataMode } from "@/lib/server/env";
import { handle, json } from "@/lib/server/http";
import { createRequestSupabase } from "@/lib/server/supabase";

export const POST = handle(async () => {
  if (dataMode() === "supabase") {
    const supabase = await createRequestSupabase();
    await supabase.auth.signOut();
  }
  return json({ ok: true });
});
