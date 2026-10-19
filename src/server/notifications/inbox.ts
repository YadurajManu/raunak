import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db/client";

export async function notifyEventChanged(input: {
  userId: string;
  orderId: string;
  eventId: string;
  title: string;
  cancelled: boolean;
  revision: string;
}) {
  const dedupeKey = createHash("sha256")
    .update(`${input.cancelled ? "event-cancelled" : "event-updated"}:${input.orderId}:${input.revision}`)
    .digest("hex");
  await db.inAppNotification.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      userId: input.userId,
      dedupeKey,
      kind: input.cancelled ? "EVENT_CANCELLED" : "EVENT_UPDATED",
      title: input.cancelled ? "Event cancelled" : "Event details updated",
      body: input.cancelled
        ? `${input.title} has been cancelled. Review your booking for the latest information.`
        : `The details for ${input.title} have changed. Review your ticket before you go.`,
      href: "/my-tickets",
    },
  });
}

export async function notifyTicketsIssued(input: {
  userId: string;
  orderId: string;
  title: string;
  count: number;
}) {
  const dedupeKey = createHash("sha256")
    .update(`tickets-issued:${input.orderId}`)
    .digest("hex");
  await db.inAppNotification.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      userId: input.userId,
      dedupeKey,
      kind: "TICKETS_ISSUED",
      title: "Your tickets are ready",
      body: `${input.count} ${input.count === 1 ? "ticket" : "tickets"} for ${input.title} are ready to view.`,
      href: `/my-tickets`,
    },
  });
}

export async function notifyReminder(input: {
  userId: string;
  orderId: string;
  title: string;
  trigger: "REMINDER_24H" | "REMINDER_2H";
  startsAt: Date;
}) {
  const dedupeKey = createHash("sha256")
    .update(`reminder:${input.orderId}:${input.trigger}:${input.startsAt.toISOString()}`)
    .digest("hex");
  const when = input.trigger === "REMINDER_24H" ? "tomorrow" : "in a couple of hours";
  await db.inAppNotification.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      userId: input.userId,
      dedupeKey,
      kind: input.trigger,
      title: "Your event is coming up",
      body: `${input.title} is happening ${when}. Your ticket is ready in My tickets.`,
      href: `/my-tickets`,
    },
  });
}

export async function notifyRefundUpdated(input: {
  userId: string;
  orderId: string;
  refundId: string;
  title: string;
  status: string;
}) {
  const dedupeKey = createHash("sha256")
    .update(`refund:${input.refundId}:${input.status}`)
    .digest("hex");
  const body = input.status === "SUCCESS"
    ? `Your refund for ${input.title} is confirmed. Your bank may take additional time to credit it.`
    : input.status === "FAILED"
      ? `Your refund for ${input.title} could not be completed. Please contact the organizer for help.`
      : `Your refund for ${input.title} is still being processed.`;
  await db.inAppNotification.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      userId: input.userId,
      dedupeKey,
      kind: "REFUND_UPDATED",
      title: input.status === "SUCCESS" ? "Refund confirmed" : "Refund update",
      body,
      href: `/orders/${input.orderId}`,
    },
  });
}

export async function listInbox(userId: string) {
  z.uuid().parse(userId);
  const [items, unreadCount] = await Promise.all([
    db.inAppNotification.findMany({
      where: { userId },
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.inAppNotification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unreadCount };
}

export async function markInboxRead(
  userId: string,
  input: unknown,
) {
  z.uuid().parse(userId);
  const data = z
    .union([
      z.object({ id: z.uuid() }).strict(),
      z.object({ all: z.literal(true) }).strict(),
    ])
    .parse(input);
  await db.inAppNotification.updateMany({
    where: {
      userId,
      readAt: null,
      ...( "id" in data ? { id: data.id } : {}),
    },
    data: { readAt: new Date() },
  });
}
