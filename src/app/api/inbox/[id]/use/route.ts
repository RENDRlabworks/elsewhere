import { getContext } from "@/lib/server/context";
import { handle, json } from "@/lib/server/http";
import { useIdea } from "@/lib/services/ideas";

/** Turn an idea into a scene in Create. Calling it again returns the same scene. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  // `useIdea` is a service function, not a React hook.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return json(await useIdea(await getContext(), id), { status: 201 });
});
