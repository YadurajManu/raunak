import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import {
  cashfree,
  type PaymentProvider,
  type ProviderPayment,
} from "@/server/providers/payments/cashfree";

import { queueTicketDelivery } from "@/server/tickets/delivery";

const cartSchema = z.object({
  eventId: z.uuid(),
  items: z
    .array(
      z.object({
        ticketTypeId: z.uuid(),
        quantity: z.number().int().positive().max(10),
      }),
    )
    .min(1)
    .max(20),
  buyerName: z.string().trim().min(2).max(100),
  buyerPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number."),
  whatsappOptIn: z.boolean().default(false),
  idempotencyKey: z.uuid(),
});
// Cashfree requires an expiry more than 15 minutes away; inventory uses the same deadline.
const ORDER_MS = 20 * 60 * 1000;
function ticketCode() {
  return randomBytes(5).toString("hex").toUpperCase();
}

async function issueTickets(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    eventId: string;
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string | null;
    items: { ticketTypeId: string; quantity: number }[];
  },
) {
  for (const item of order.items)
    for (let i = 0; i < item.quantity; i++)
      await tx.ticket.create({
        data: {
          orderId: order.id,
          eventId: order.eventId,
          ticketTypeId: item.ticketTypeId,
          code: ticketCode(),
          holderName: order.buyerName,
          holderEmail: order.buyerEmail,
          holderPhone: order.buyerPhone,
        },
      });
}

export async function createCheckout(
  buyer: { id: string; email: string },
  input: unknown,
  provider: PaymentProvider = cashfree,
) {
  const data = cartSchema.parse(input);
  const unique = new Set(data.items.map((item) => item.ticketTypeId));
  if (unique.size !== data.items.length)
    throw new Error("Duplicate ticket type in cart.");
  const existing = await db.order.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
    include: { items: true },
  });
  if (existing) {
    if (
      existing.buyerId !== buyer.id ||
      existing.eventId !== data.eventId ||
      existing.buyerName !== data.buyerName ||
      existing.buyerPhone !== data.buyerPhone ||
      existing.whatsappOptIn !== data.whatsappOptIn ||
      existing.items.length !== data.items.length ||
      existing.items.some(
        (item) =>
          data.items.find((line) => line.ticketTypeId === item.ticketTypeId)
            ?.quantity !== item.quantity,
      )
    )
      throw new Error("Idempotency key was used for another cart.");
    if (existing.status !== "PENDING" || existing.paymentSessionId)
      return existing;
  }
  const order =
    existing ||
    (await db
      .$transaction(async (tx) => {
        const now = new Date();
        await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${data.eventId}::uuid FOR UPDATE`;
        const event = await tx.event.findFirst({
          where: {
            id: data.eventId,
            status: "PUBLISHED",
            deletedAt: null,
            startsAt: { gt: now },
            org: { status: "ACTIVE" },
          },
          include: { org: true },
        });
        if (!event) throw new Error("Event is unavailable.");
        const types = await tx.ticketType.findMany({
          where: { eventId: data.eventId, id: { in: [...unique] } },
        });
        if (types.length !== unique.size)
          throw new Error("Ticket type not found.");
        if (event.capacity !== null) {
          const inventory = await tx.ticketType.aggregate({
            where: { eventId: event.id },
            _sum: { quantitySold: true, quantityHeld: true },
          });
          if (
            (inventory._sum.quantitySold || 0) +
              (inventory._sum.quantityHeld || 0) +
              data.items.reduce((n, item) => n + item.quantity, 0) >
            event.capacity
          )
            throw new Error("Event capacity reached.");
        }
        let subtotalPaise = 0;
        let quantity = 0;
        for (const line of data.items) {
          const type = types.find((item) => item.id === line.ticketTypeId)!;
          if (
            (type.saleStartsAt && type.saleStartsAt > now) ||
            (type.saleEndsAt && type.saleEndsAt < now)
          )
            throw new Error(`${type.name} is not on sale.`);
          if (
            line.quantity < type.minPerOrder ||
            line.quantity > type.maxPerOrder
          )
            throw new Error(
              `Quantity for ${type.name} is outside the allowed range.`,
            );
          if (type.isHidden) throw new Error("Ticket type is unavailable.");
          const held =
            await tx.$executeRaw`UPDATE "TicketType" SET "quantityHeld" = "quantityHeld" + ${line.quantity}, "updatedAt" = NOW() WHERE id = ${type.id}::uuid AND "eventId" = ${data.eventId}::uuid AND "quantityTotal" - "quantitySold" - "quantityHeld" >= ${line.quantity}`;
          if (!held) throw new Error(`${type.name} is sold out.`);
          subtotalPaise += type.pricePaise * line.quantity;
          quantity += line.quantity;
        }
        const feePaise = subtotalPaise
          ? Math.round((subtotalPaise * event.org.platformFeeBps) / 10000) +
            event.org.platformFeeFixedPaise * quantity
          : 0;
        const totalPaise =
          subtotalPaise +
          (event.org.feeMode === "PASS_TO_BUYER" ? feePaise : 0);
        if (totalPaise > 0 && totalPaise < 100) throw new Error("Paid bookings must total at least ₹1.");
    const expiresAt = new Date(now.getTime() + ORDER_MS);
        const result = await tx.order.create({
          data: {
            eventId: event.id,
            buyerId: buyer.id,
            buyerName: data.buyerName,
            buyerEmail: buyer.email,
            buyerPhone: data.buyerPhone,
            whatsappOptIn: data.whatsappOptIn,
            idempotencyKey: data.idempotencyKey,
            subtotalPaise,
            feePaise,
            totalPaise,
            expiresAt,
            cashfreeOrderId: totalPaise ? randomUUID() : null,
            items: {
              create: data.items.map((line) => ({
                ticketTypeId: line.ticketTypeId,
                quantity: line.quantity,
                unitPricePaise: types.find(
                  (type) => type.id === line.ticketTypeId,
                )!.pricePaise,
              })),
            },
          },
          include: { items: true },
        });
        if (!totalPaise) {
          for (const line of data.items)
            await tx.ticketType.update({
              where: { id: line.ticketTypeId },
              data: {
                quantityHeld: { decrement: line.quantity },
                quantitySold: { increment: line.quantity },
              },
            });
          await tx.order.update({
            where: { id: result.id },
            data: { status: "PAID" },
          });
          await issueTickets(tx, result);
          return { ...result, status: "PAID" as const };
        }
        return result;
      })
      .catch(async (error) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const replay = await db.order.findUnique({
            where: { idempotencyKey: data.idempotencyKey },
            include: { items: true },
          });
          if (
            replay &&
            replay.buyerId === buyer.id &&
            replay.eventId === data.eventId &&
            replay.whatsappOptIn === data.whatsappOptIn &&
            replay.buyerName === data.buyerName &&
            replay.buyerPhone === data.buyerPhone &&
            replay.items.length === data.items.length &&
            replay.items.every(
              (item) =>
                data.items.find(
                  (line) => line.ticketTypeId === item.ticketTypeId,
                )?.quantity === item.quantity,
            )
          )
            return replay;
        }
        throw error;
      }));
  if (order.status === "PAID") {
    try {
      await queueTicketDelivery(order.id);
    } catch {
      /* Maintenance recovers paid orders from the database. */
    }
  }
  if (
    order.status === "PAID" ||
    !order.cashfreeOrderId ||
    order.paymentSessionId
  )
    return order;
  try {
    const envUrl = z.url().parse(process.env.APP_URL);
    const payment = await provider.createOrder({
      orderId: order.cashfreeOrderId,
      amountPaise: order.totalPaise,
      customerId: buyer.id,
      name: order.buyerName,
      email: order.buyerEmail,
      phone: order.buyerPhone!,
      returnUrl: `${envUrl}/orders/${order.id}`,
      notifyUrl: `${envUrl}/api/webhooks/cashfree`,
      expiresAt: order.expiresAt,
    });
    return db.order.update({
      where: { id: order.id },
      data: { paymentSessionId: payment.paymentSessionId },
      include: { items: true },
    });
  } catch (error) {
    await releaseOrder(order.id, "FAILED");
    throw error;
  }
}

export async function releaseOrder(
  orderId: string,
  status: "FAILED" | "EXPIRED",
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    if (order.status !== "PENDING") return order;
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${order.eventId}::uuid FOR UPDATE`;
    if (status === "EXPIRED" && order.expiresAt > new Date()) return order;
    for (const item of order.items)
      await tx.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { quantityHeld: { decrement: item.quantity } },
      });
    if (status === "FAILED")
      await tx.webhookEvent.upsert({
        where: {
          provider_idempotencyKey: {
            provider: "internal-orders",
            idempotencyKey: `failed-${orderId}`,
          },
        },
        update: {},
        create: {
          provider: "internal-orders",
          idempotencyKey: `failed-${orderId}`,
          payload: { orderId, trigger: "PAYMENT_FAILED" },
        },
      });
    return tx.order.update({ where: { id: orderId }, data: { status } });
  });
}

export async function applyPayment(
  orderId: string,
  payment: ProviderPayment,
  provider: PaymentProvider = cashfree,
) {
  const action = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    if (payment.status !== "SUCCESS") return { order, refund: false };
    if (payment.amountPaise !== order.totalPaise || !order.totalPaise)
      throw new Error("Payment amount does not match order.");
    if (await tx.payment.findUnique({ where: { cfPaymentId: payment.id } }))
      return { order, refund: false };
    if (order.status === "PAID") return { order, refund: false };
    const current = await tx.payment.create({
      data: {
        orderId,
        cfPaymentId: payment.id,
        method: payment.method,
        status: "SUCCESS",
        amountPaise: payment.amountPaise,
        rawPayload: payment.raw as Prisma.InputJsonValue,
        paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
      },
    });
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${order.eventId}::uuid FOR UPDATE`;
    const currentEvent = await tx.event.findUniqueOrThrow({ where: { id: order.eventId } });
    if (order.status === "PENDING" &&
        (currentEvent.status !== "PUBLISHED" || currentEvent.deletedAt || currentEvent.startsAt <= new Date())) {
      for (const item of order.items)
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { quantityHeld: { decrement: item.quantity } },
        });
      const expired = await tx.order.update({ where: { id: order.id }, data: { status: "EXPIRED" } });
      await tx.refund.create({ data: {
        paymentId: current.id,
        amountPaise: payment.amountPaise,
        status: "PENDING",
        reason: "Event unavailable when payment was received",
      } });
      return { order: expired, refund: true };
    }
    if (order.status === "PENDING") {
      for (const item of order.items)
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: {
            quantityHeld: { decrement: item.quantity },
            quantitySold: { increment: item.quantity },
          },
        });
    } else {
      await tx.$queryRaw`SELECT id FROM "TicketType" WHERE "eventId" = ${order.eventId}::uuid FOR UPDATE`;
      const types = await tx.ticketType.findMany({
        where: { id: { in: order.items.map((item) => item.ticketTypeId) } },
      });
      const event = await tx.event.findUniqueOrThrow({
        where: { id: order.eventId },
      });
      const inventory = await tx.ticketType.aggregate({
        where: { eventId: order.eventId },
        _sum: { quantitySold: true, quantityHeld: true },
      });
      const used =
        (inventory._sum.quantitySold || 0) + (inventory._sum.quantityHeld || 0);
      const available =
        event.status === "PUBLISHED" &&
        !event.deletedAt &&
        event.startsAt > new Date() &&
        (event.capacity === null ||
          used + order.items.reduce((n, item) => n + item.quantity, 0) <=
            event.capacity) &&
        order.items.every((item) => {
          const type = types.find((row) => row.id === item.ticketTypeId);
          return (
            type &&
            type.quantityTotal - type.quantitySold - type.quantityHeld >=
              item.quantity
          );
        });
      if (!available) {
        await tx.refund.create({
          data: {
            paymentId: current.id,
            amountPaise: payment.amountPaise,
            status: "PENDING",
            reason: "Inventory unavailable after late payment",
          },
        });
        return { order, refund: true };
      }
      for (const item of order.items)
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { quantitySold: { increment: item.quantity } },
        });
    }
    const paid = await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });
    await issueTickets(tx, order);
    return { order: paid, refund: false };
  });
  if (action.refund) await retryRefunds(provider);
  if (action.order.status === "PAID") {
    try {
      await queueTicketDelivery(action.order.id);
    } catch {
      /* Maintenance recovers paid orders from the database. */
    }
  }
  return action.order;
}

export async function reconcileOrder(
  orderId: string,
  provider: PaymentProvider = cashfree,
) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (
    !order.cashfreeOrderId ||
    order.status === "PAID" ||
    order.status === "REFUNDED"
  )
    return order;
  const payments = await provider.getPayments(order.cashfreeOrderId);
  const success = payments.find((payment) => payment.status === "SUCCESS");
  if (success) return applyPayment(orderId, success, provider);
  if (order.status === "PENDING" && order.expiresAt <= new Date())
    return releaseOrder(orderId, "EXPIRED");
  return order;
}

export async function expireOrders(provider: PaymentProvider = cashfree) {
  const pending = await db.order.findMany({
    where: { status: "PENDING", expiresAt: { lte: new Date() } },
    select: { id: true },
    take: 100,
  });
  for (const order of pending) {
    try {
      await reconcileOrder(order.id, provider);
    } catch {
      await releaseOrder(order.id, "EXPIRED");
    }
  }
  await retryRefunds(provider);
  return pending.length;
}

export async function retryRefunds(provider: PaymentProvider = cashfree) {
  const refunds = await db.refund.findMany({
    where: { status: { in: ["PENDING", "FAILED"] } },
    include: { payment: { include: { order: true } } },
    take: 100,
  });
  for (const refund of refunds) {
    const orderId = refund.payment.order.cashfreeOrderId;
    if (!orderId) continue;
    try {
      let result;
      if (refund.cfRefundId)
        result = await provider.getRefund(orderId, refund.id);
      else {
        try {
          result = await provider.refund({
            orderId,
            refundId: refund.id,
            amountPaise: refund.amountPaise,
            reason: refund.reason || "Tickets unavailable",
          });
        } catch {
          result = await provider.getRefund(orderId, refund.id);
        }
      }
      await db.$transaction(async (tx) => {
        await tx.refund.update({
          where: { id: refund.id },
          data: { cfRefundId: result.providerRefundId, status: result.status },
        });
        if (result.status === "SUCCESS")
          await tx.order.updateMany({
            where: { id: refund.payment.orderId, status: { not: "PAID" } },
            data: { status: "REFUNDED" },
          });
      });
    } catch {
      await db.refund.update({
        where: { id: refund.id },
        data: { status: "FAILED" },
      });
    }
  }
}
