import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { updateTicketType, deleteTicketType } from "@/server/tickets/types";
type Context = { params: Promise<{ eventId: string; ticketTypeId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId, ticketTypeId } = await params;
    return Response.json(
      await updateTicketType(
        user.id,
        eventId,
        ticketTypeId,
        await request.json(),
      ),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update ticket type.",
      },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId, ticketTypeId } = await params;
    await deleteTicketType(user.id, eventId, ticketTypeId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not delete ticket type.",
      },
      { status: 400 },
    );
  }
}
