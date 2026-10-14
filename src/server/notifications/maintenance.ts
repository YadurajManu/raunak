import { z } from "zod";
import { db } from "@/server/db/client";
import {
  enqueueEventNotifications,
  enqueueNotification,
  enqueueOrderNotifications,
  queueNotification,
} from "./service";
import { prepareTicketPdfs } from "@/server/tickets/pdf";
import { queueTicketDelivery } from "@/server/tickets/delivery";
import { processOperationsEmail } from "@/server/operations/email";

export async function fulfilOrder(orderId: string) {
  await prepareTicketPdfs(orderId);
  await enqueueOrderNotifications(orderId);
}
export async function maintainNotifications() {
  const orders = await db.order.findMany({
    where: {
      status: "PAID",
      OR: [
        { fulfilmentQueuedAt: null },
        { tickets: { some: { pdfKey: null } } },
      ],
    },
    select: { id: true },
    take: 100,
  });
  for (const order of orders) await queueTicketDelivery(order.id);
  const events = await db.webhookEvent.findMany({
    where: {
      provider: { in: ["internal-events", "internal-orders", "operations-email"] },
      status: { in: ["RECEIVED", "FAILED"] },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  for (const event of events) {
    try {
      if (event.provider === "internal-events") {
        const data = z
          .object({
            eventId: z.uuid(),
            trigger: z.enum(["EVENT_UPDATED", "EVENT_CANCELLED"]),
          })
          .parse(event.payload);
        if (await db.event.findUnique({ where: { id: data.eventId } }))
          await enqueueEventNotifications(data.eventId, data.trigger);
      } else if (event.provider === "operations-email") {
        await processOperationsEmail(event.payload, event.idempotencyKey);
      } else {
        const data = z
          .object({ orderId: z.uuid(), trigger: z.literal("PAYMENT_FAILED") })
          .parse(event.payload);
        if (await db.order.findUnique({ where: { id: data.orderId } }))
          await enqueueNotification(data.orderId, data.trigger);
      }
      await db.webhookEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
    } catch {
      await db.webhookEvent.update({
        where: { id: event.id },
        data: { status: "FAILED" },
      });
    }
  }
  // Recover leases after a worker crash. Providers are at-least-once; Meta callback IDs reconcile status.
  await db.notificationLog.updateMany({
    where: {
      status: "SENDING",
      updatedAt: { lt: new Date(Date.now() - 5 * 60000) },
    },
    data: { status: "QUEUED" },
  });
  const pending = await db.notificationLog.findMany({
    where: { status: "QUEUED" },
    select: { id: true },
    take: 500,
  });
  for (const log of pending) await queueNotification(log.id);
}
