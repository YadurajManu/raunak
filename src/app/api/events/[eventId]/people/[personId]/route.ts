import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { updatePerson, deletePerson } from "@/server/media/people";

type Context = { params: Promise<{ eventId: string; personId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId, personId } = await params;
    return Response.json(
      await updatePerson(user.id, eventId, personId, await request.json()),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update person.",
      },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId, personId } = await params;
    await deletePerson(user.id, eventId, personId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not delete person.",
      },
      { status: 400 },
    );
  }
}
