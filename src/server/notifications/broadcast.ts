import { createHash } from "node:crypto";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { db } from "@/server/db/client";
import { messageAccess } from "./access";
import { broadcastVariables, validateBroadcastBody } from "./templates";
import { resolveWhatsApp } from "@/server/whatsapp/routing";
import { notificationQueue, producerConnection } from "../../../worker/queues";
import { transactionalTriggers } from "@raunak/wa-contracts";

const inputSchema = z.object({
  campaignId: z.uuid(),
  body: z.string().trim().min(4).max(1200),
});

export async function whatsappBroadcastAudience(eventId: string, orgId: string) {
  const orders = await db.order.findMany({
    where: {
      eventId,
      status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
      whatsappOptIn: true,
      buyerPhone: { not: null },
      tickets: { some: { status: { in: ["VALID", "USED"] } } },
    },
    select: { id: true, buyerPhone: true, buyerName: true },
    orderBy: { createdAt: "asc" },
  });
  const recipients = new Map<
    string,
    { orderId: string; phone: string; name: string }
  >();
  for (const order of orders) {
    const phone = parsePhoneNumberFromString(order.buyerPhone || "", "IN");
    if (phone?.isValid() && !recipients.has(phone.number))
      recipients.set(phone.number, {
        orderId: order.id,
        phone: phone.number,
        name: order.buyerName,
      });
  }
  if (!recipients.size)
    return { recipients: [], suppressed: 0, invalid: orders.length };
  const numbers = [...recipients.keys()];
  const suppressions = await db.whatsAppSuppression.findMany({
    where: {
      phoneE164: { in: numbers },
      OR: [{ orgId }, { orgId: null }],
    },
    select: { phoneE164: true },
  });
  const blocked = new Set(suppressions.map((item) => item.phoneE164));
  const allowed = [...recipients.values()].filter((item) => !blocked.has(item.phone));
  return {
    recipients: allowed,
    suppressed: blocked.size,
    invalid: Math.max(0, orders.length - recipients.size),
  };
}

export async function sendEventWhatsAppBroadcast(
  userId: string,
  eventId: string,
  rawInput: unknown,
) {
  const access = await messageAccess(userId, eventId);
  const { campaignId, body } = inputSchema.parse(rawInput);
  validateBroadcastBody(body);
  const event = await db.event.findFirst({
    where: { id: eventId, orgId: access.orgId, deletedAt: null },
    include: { org: true },
  });
  if (!event || event.status !== "PUBLISHED")
    throw new Error("Only published events can message attendees.");
  if (!["ORG_NUMBER", "PLATFORM_NUMBER"].includes(event.org.whatsappMode))
    throw new Error("Choose a connected linked-device number in WhatsApp settings first.");
  const route = await resolveWhatsApp(event.orgId);
  if (route.kind !== "gateway")
    throw new Error("The linked WhatsApp number is not connected.");
  const { recipients, suppressed, invalid } = await whatsappBroadcastAudience(
    event.id,
    event.orgId,
  );
  if (!recipients.length)
    throw new Error("No paid attendees with WhatsApp consent are eligible.");
  const rate = Number(
    await producerConnection.eval(
      `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; return n`,
      1,
      `wa:broadcast:${event.orgId}:${userId}`,
    ),
  );
  if (rate > 5) throw new Error("Please wait before sending another attendee update.");

  const dedupeKeys = recipients.map(({ orderId, phone }) =>
    createHash("sha256")
      .update(`${campaignId}|${event.id}|${orderId}|${phone}`)
      .digest("hex"),
  );
  await db.notificationLog.createMany({
    data: recipients.map((recipient, index) => ({
      dedupeKey: dedupeKeys[index],
      orgId: event.orgId,
      eventId: event.id,
      orderId: recipient.orderId,
      channel: "WHATSAPP" as const,
      trigger: "ATTENDEE_BROADCAST" as const,
      toAddress: recipient.phone,
      campaignText: body,
    })),
    skipDuplicates: true,
  });
  const logs = await db.notificationLog.findMany({
    where: { dedupeKey: { in: dedupeKeys }, status: "QUEUED" },
    select: { id: true },
  });
  await notificationQueue.addBulk(
    logs.map(({ id }) => ({
      name: "send",
      data: { id },
      opts: {
        jobId: id,
        attempts: 5,
        priority: transactionalTriggers.indexOf("ATTENDEE_BROADCAST") + 1,
        backoff: { type: "exponential" as const, delay: 5000, jitter: 0.2 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    })),
  );
  await db.auditLog.create({
    data: {
      orgId: event.orgId,
      actorId: userId,
      action: "whatsapp.attendee-broadcast.queued",
      entityType: "Event",
      entityId: event.id,
      meta: { campaignId, recipientCount: logs.length, suppressed, invalid },
    },
  });
  return { queued: logs.length, suppressed, invalid };
}

export { broadcastVariables };
