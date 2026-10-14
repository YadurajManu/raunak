import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { resendOrderNotifications } from "@/server/notifications/service";
import { resendTickets } from "@/server/tickets/delivery";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    await resendTickets(user.id, id);
    await resendOrderNotifications(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not resend tickets.",
      },
      { status: 400 },
    );
  }
}
