import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

export async function checkoutSnapshot(id: string, buyerId: string) {
  const order = await db.order.findFirst({
    where: { id: z.uuid().parse(id), buyerId },
    include: { items: { orderBy: { ticketTypeId: "asc" }, include: { ticketType: true } } },
  });
  if (!order) return null;
  return {
    id: order.id,
    status: order.status,
    expiresAt: order.expiresAt,
    paymentSessionId:
      order.status === "PENDING" && order.expiresAt > new Date()
        ? order.paymentSessionId
        : null,
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    buyerPhone: order.buyerPhone,
    whatsappOptIn: order.whatsappOptIn,
    attendeeNames: order.attendeeNames,
    subtotalPaise: order.subtotalPaise,
    feePaise: Math.max(0, order.totalPaise - order.subtotalPaise),
    totalPaise: order.totalPaise,
    items: order.items.map((item) => ({
      ticketTypeId: item.ticketTypeId,
      name: item.ticketType.name,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      lineTotalPaise: item.unitPricePaise * item.quantity,
    })),
  };
}

export function checkoutError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const status =
    message === "Authentication required."
      ? 401
      : message === "Request origin is not allowed."
        ? 403
        : error instanceof Prisma.PrismaClientKnownRequestError
          ? 503
          : 400;
  const expected =
    /^(Authentication required\.|Request origin is not allowed\.|Event is unavailable\.|Event capacity reached\.|Ticket type (is unavailable|not found)\.|Duplicate ticket type|Idempotency key|Cashfree (requires|request failed|credentials)|Paid bookings|Demo events|Quantity for )/.test(
      message,
    ) ||
    /^.{1,100} (is not on sale\.|is sold out\.|has only \d+ tickets left\.)$/.test(
      message,
    );
  const safe =
    error instanceof z.ZodError
      ? error.issues[0]?.message || "Check your booking details."
      : expected
        ? message
        : "We couldn't complete your booking. Please try again.";
  return Response.json(
    { error: safe },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
