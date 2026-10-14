import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { unassignEventStaff } from "@/server/events/staff";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string; userId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId, userId } = await params;
    await unassignEventStaff(user.id, eventId, userId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not unassign staff.",
      },
      { status: 400 },
    );
  }
}
