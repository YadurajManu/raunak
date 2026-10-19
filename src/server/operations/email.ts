import { z } from "zod";
import { db } from "@/server/db/client";
import {
  sendEmail,
  type EmailProvider,
} from "@/server/providers/email/provider";
import { emailMarkup } from "@/server/notifications/email-markup";
import { formatInr } from "@/lib/money";
import { notifyRefundUpdated } from "@/server/notifications/inbox";

export async function processOperationsEmail(
  payload: unknown,
  key: string,
  provider: EmailProvider = { send: sendEmail },
) {
  const data = z
    .object({
      orderId: z.uuid(),
      kind: z.enum(["BOOKING_CANCELLED", "REFUND_UPDATED"]),
      refundId: z.uuid().optional(),
    })
    .parse(payload);
  const order = await db.order.findUnique({
    where: { id: data.orderId },
    include: { event: { include: { org: true } } },
  });
  if (!order) return;
  const refund = data.refundId
    ? await db.refund.findFirst({
        where: { id: data.refundId, payment: { orderId: order.id } },
      })
    : null;
  if (data.kind === "REFUND_UPDATED" && !refund) return;
  if (
    data.kind === "REFUND_UPDATED" &&
    key !== `refund-${refund!.id}-${refund!.status}`
  )
    return;
  if (data.kind === "REFUND_UPDATED") {
    try {
      await notifyRefundUpdated({
        userId: order.buyerId,
        orderId: order.id,
        refundId: refund!.id,
        title: order.event.title,
        status: refund!.status,
      });
    } catch {
      // Inbox availability must not block the existing refund email.
    }
  }
  const text =
    data.kind === "BOOKING_CANCELLED"
      ? `Hi ${order.buyerName}, your booking has been cancelled and its entry tickets are no longer valid.${order.totalPaise ? (order.status === "REFUNDED" ? " Your refund has been confirmed by Cashfree; your bank may take additional time to credit it." : " Your refund has been requested; it is not complete until confirmed by the payment provider.") : " This was a free booking, so no payment refund is needed."}`
      : `Hi ${order.buyerName}, your refund of ${formatInr(refund!.amountPaise)} is ${refund!.status === "SUCCESS" ? "confirmed by Cashfree. Your bank may take additional time to credit it" : refund!.status === "FAILED" ? "awaiting organizer review. Please contact the organizer with your order reference" : "still being processed. We will update your booking when Cashfree confirms it"}.`;
  const values = {
    event_title: order.event.title,
    event_date: new Intl.DateTimeFormat("en-IN", {
      dateStyle: "long",
      timeZone: order.event.timezone,
    }).format(order.event.startsAt),
    event_time: new Intl.DateTimeFormat("en-IN", {
      timeStyle: "short",
      timeZone: order.event.timezone,
    }).format(order.event.startsAt),
    venue: order.event.venueName || order.event.address || "",
    city: order.event.city || "",
    quantity: "—",
    order_id: order.id,
    ticket_url: `${process.env.APP_URL}/orders/${order.id}`,
    organizer_name: order.event.org.name,
    support_contact:
      order.event.org.supportEmail || `${process.env.APP_URL}/contact`,
  };
  await provider.send({
    to: order.buyerEmail,
    subject: `${order.event.title} · ${data.kind === "BOOKING_CANCELLED" ? "Booking cancelled" : "Refund update"}`,
    text,
    html: emailMarkup(text, values, false, data.kind),
    idempotencyKey: key,
  });
}
