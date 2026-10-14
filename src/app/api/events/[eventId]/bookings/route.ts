import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { refundBooking } from "@/server/operations/refunds";
import { retryRefunds } from "@/server/checkout/service";
import { resendOrderNotifications } from "@/server/notifications/service";
import { queueTicketDelivery } from "@/server/tickets/delivery";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId } = await params;
    const data = z
      .object({
        action: z.enum(["REFUND", "RESEND", "REFRESH_REFUND"]),
        orderId: z.uuid(),
        reason: z.string().optional(),
      })
      .parse(await request.json());
    if (data.action === "REFUND")
      return Response.json(await refundBooking(user.id, eventId, data));
    await requireEventAccessForUser(
      user.id,
      eventId,
      data.action === "RESEND"
        ? ["OWNER", "ADMIN", "MANAGER"]
        : ["OWNER", "ADMIN", "FINANCE"],
    );
    const order = await db.order.findFirst({
      where: { id: data.orderId, eventId },
    });
    if (!order) throw new Error("Booking not found.");
    if (data.action === "RESEND") {
      const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { status: true } });
      if (event.status === "CANCELLED") throw new Error("This event is cancelled. Review the booking refund instead of resending entry tickets.");
      if (order.status !== "PAID")
        throw new Error("Only confirmed bookings have active tickets.");
      await queueTicketDelivery(order.id);
      await resendOrderNotifications(order.buyerId, order.id);
    } else await retryRefunds(undefined, order.id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0].message
            : error instanceof Error && !error.message.includes("prisma")
              ? error.message
              : "Could not update booking. Please try again.",
      },
      { status: 400 },
    );
  }
}
