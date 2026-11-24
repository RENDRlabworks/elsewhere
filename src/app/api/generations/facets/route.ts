import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";
import { archiveFacets } from "@/lib/services/archive";

export const GET = handle(async () => json(await archiveFacets(await getContext())));
