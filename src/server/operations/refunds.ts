import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "@/server/db/client";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { retryRefunds } from "@/server/checkout/service";
import {
  cashfree,
  type PaymentProvider,
} from "@/server/providers/payments/cashfree";

export async function refundBooking(
  userId: string,
  eventId: string,
  input: unknown,
  provider: PaymentProvider = cashfree,
) {
  const access = await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "FINANCE",
  ]);
  const { orderId, reason } = z
    .object({ orderId: z.uuid(), reason: z.string().trim().min(5).max(200) })
    .parse(input);
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findFirst({
      where: { id: orderId, eventId },
      include: {
        payments: { where: { status: "SUCCESS" }, include: { refunds: true } },
      },
    });
    if (!order) throw new Error("Booking not found.");
    const existing = order.payments.flatMap((payment) => payment.refunds)[0];
    if (existing) return { orderId, refundId: existing.id };
    if (order.status === "CANCELLED" && !order.totalPaise)
      return { orderId, refundId: null };
    if (order.status !== "PAID")
      throw new Error("Only confirmed bookings can be cancelled or refunded.");
    const payment = order.payments.find(
      (payment) => payment.amountPaise === order.totalPaise,
    );
    if (order.totalPaise && (!payment || !order.cashfreeOrderId))
      throw new Error("A verified payment is required before refunding.");
    if (payment && order.totalPaise) {
      const deadline = Temporal.Instant.from(
        (payment.paidAt || payment.createdAt).toISOString(),
      )
        .toZonedDateTimeISO("UTC")
        .add({ months: 6 });
      if (deadline.epochMilliseconds < Date.now())
        throw new Error(
          "Cashfree's refund window has expired. Review this payment in Cashfree before cancelling the booking.",
        );
    }
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const tickets = await tx.ticket.groupBy({
      by: ["ticketTypeId"],
      where: { orderId, status: { in: ["VALID", "USED"] } },
      _count: true,
    });
    await tx.ticket.updateMany({
      where: { orderId, status: { in: ["VALID", "USED"] } },
      data: { status: "CANCELLED" },
    });
    for (const group of tickets)
      await tx.$executeRaw`UPDATE "TicketType" SET "quantitySold" = GREATEST(0, "quantitySold" - ${group._count}), "updatedAt" = NOW() WHERE id = ${group.ticketTypeId}::uuid`;
    await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });
    const refund =
      payment && order.totalPaise
        ? await tx.refund.create({
            data: {
              paymentId: payment.id,
              amountPaise: order.totalPaise,
              reason,
              status: "PENDING",
            },
          })
        : null;
    await tx.auditLog.create({
      data: {
        orgId: access.orgId,
        actorId: userId,
        action: refund ? "booking.refund_requested" : "booking.cancelled",
        entityType: "Order",
        entityId: orderId,
        meta: {
          eventId,
          reason,
          amountPaise: order.totalPaise,
          refundId: refund?.id,
        },
      },
    });
    await tx.webhookEvent.create({
      data: {
        provider: "operations-email",
        idempotencyKey: `booking-cancelled-${orderId}`,
        payload: { orderId, kind: "BOOKING_CANCELLED" },
      },
    });
    return { orderId, refundId: refund?.id || null };
  });
  if (result.refundId) await retryRefunds(provider, result.orderId);
  return result;
}
