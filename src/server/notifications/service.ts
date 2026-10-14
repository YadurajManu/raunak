import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { db } from "@/server/db/client";
import {
  Prisma,
  type Channel,
  type MessageTrigger,
} from "@/generated/prisma/client";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { notificationQueue } from "../../../worker/queues";
import { ticketUrl } from "@/server/tickets/qr";
import { storage } from "@/server/providers/storage/s3";
import {
  sendEmail,
  type EmailProvider,
} from "@/server/providers/email/provider";
import {
  whatsapp,
  type WhatsAppProvider,
} from "@/server/providers/whatsapp/provider";
import {
  defaultBodies,
  renderTemplate,
  escapeHtml,
  triggerSchema,
  whatsappTemplate,
} from "./templates";
import { formatInr } from "@/lib/money";

export async function resolvedTemplate(
  orgId: string,
  eventId: string,
  trigger: MessageTrigger,
  channel: Channel,
) {
  const templates = await db.messageTemplate.findMany({
    where: { orgId, trigger, channel, OR: [{ eventId }, { eventId: null }] },
  });
  return (
    templates.find((x) => x.eventId === eventId) ||
    templates.find((x) => x.eventId === null) ||
    null
  );
}
export async function queueNotification(id: string) {
  const log = await db.notificationLog.findUniqueOrThrow({ where: { id } });
  const job = await notificationQueue.getJob(id);
  if (!job)
    await notificationQueue.add(
      "send",
      { id },
      {
        jobId: id,
        delay: Math.max(0, (log.scheduledAt?.getTime() || 0) - Date.now()),
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
}
export async function enqueueNotification(
  orderId: string,
  trigger: MessageTrigger,
  ticketId?: string,
  scheduledAt?: Date,
  revision = "",
) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const event = await db.event.findUniqueOrThrow({
    where: { id: order.eventId },
  });
  for (const channel of ["EMAIL", "WHATSAPP"] as const) {
    if (
      channel === "WHATSAPP" &&
      (!order.whatsappOptIn ||
        !order.buyerPhone ||
        !parsePhoneNumberFromString(order.buyerPhone, "IN")?.isValid())
    )
      continue;
    const template = await resolvedTemplate(
      event.orgId,
      event.id,
      trigger,
      channel,
    );
    if (template && !template.isEnabled) continue;
    const key = createHash("sha256")
      .update(
        [
          orderId,
          trigger,
          channel,
          ticketId || "",
          scheduledAt?.toISOString() || "",
          revision,
        ].join("|"),
      )
      .digest("hex");
    const log = await db.notificationLog.upsert({
      where: { dedupeKey: key },
      update: {},
      create: {
        dedupeKey: key,
        orgId: event.orgId,
        eventId: event.id,
        orderId,
        ticketId,
        trigger,
        channel,
        toAddress:
          channel === "EMAIL"
            ? order.buyerEmail
            : parsePhoneNumberFromString(order.buyerPhone!, "IN")!.number,
        templateId: template?.id,
        scheduledAt,
      },
    });
    try {
      await queueNotification(log.id);
    } catch {
      /* Maintenance recovers durable queued notifications. */
    }
  }
}
export async function enqueueOrderNotifications(
  orderId: string,
  revision = "",
) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { event: true, tickets: true },
  });
  if (order.status !== "PAID") return;
  await enqueueNotification(
    orderId,
    "ORDER_CONFIRMED",
    undefined,
    undefined,
    revision,
  );
  for (const ticket of order.tickets) {
    await enqueueNotification(
      orderId,
      "TICKET_ISSUED",
      ticket.id,
      undefined,
      revision,
    );
    for (const [trigger, hours] of [
      ["REMINDER_24H", 24],
      ["REMINDER_2H", 2],
    ] as const) {
      const at = new Date(order.event.startsAt.getTime() - hours * 3600000);
      if (at.getTime() > Date.now())
        await enqueueNotification(orderId, trigger, ticket.id, at);
    }
  }
  await db.order.update({
    where: { id: orderId },
    data: { fulfilmentQueuedAt: new Date() },
  });
}
export async function enqueueEventNotifications(
  eventId: string,
  trigger: "EVENT_UPDATED" | "EVENT_CANCELLED",
) {
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  for (const [reminder, hours] of [
    ["REMINDER_24H", 24],
    ["REMINDER_2H", 2],
  ] as const) {
    await db.notificationLog.updateMany({
      where: {
        eventId,
        trigger: reminder,
        status: "QUEUED",
        ...(trigger === "EVENT_UPDATED"
          ? {
              scheduledAt: {
                not: new Date(event.startsAt.getTime() - hours * 3600000),
              },
            }
          : {}),
      },
      data: { status: "SKIPPED", error: "Superseded by an event update." },
    });
  }
  const orders = await db.order.findMany({
    where: { eventId, status: "PAID" },
    select: { id: true },
  });
  for (const order of orders) {
    await enqueueNotification(
      order.id,
      trigger,
      undefined,
      undefined,
      event.updatedAt.toISOString(),
    );
    if (trigger === "EVENT_UPDATED") await enqueueOrderNotifications(order.id);
  }
}
export async function processNotification(
  id: string,
  providers: { email: EmailProvider; whatsapp: WhatsAppProvider } = {
    email: { send: sendEmail },
    whatsapp,
  },
) {
  const log = await db.notificationLog.findUniqueOrThrow({
    where: { id },
    include: {
      event: { include: { org: true } },
      order: { include: { tickets: { include: { ticketType: true } } } },
    },
  });
  if (log.status !== "QUEUED") return;
  const template = await resolvedTemplate(
    log.orgId,
    log.eventId,
    log.trigger,
    log.channel,
  );
  if (
    (template && !template.isEnabled) ||
    (log.trigger !== "EVENT_CANCELLED" &&
      (log.event.status === "CANCELLED" || log.event.deletedAt)) ||
    (log.trigger !== "PAYMENT_FAILED" && log.order.status !== "PAID") ||
    (log.trigger === "PAYMENT_FAILED" &&
      !["FAILED", "EXPIRED"].includes(log.order.status))
  ) {
    await db.notificationLog.update({
      where: { id },
      data: { status: "SKIPPED", error: "Message no longer applies." },
    });
    return;
  }
  const claimed = await db.notificationLog.updateMany({
    where: { id, status: "QUEUED" },
    data: { status: "SENDING", attempts: { increment: 1 } },
  });
  if (!claimed.count) return;
  try {
    const ticket =
      log.order.tickets.find((x) => x.id === log.ticketId) ||
      log.order.tickets[0];
    const slots =
      template?.slots &&
      typeof template.slots === "object" &&
      !Array.isArray(template.slots)
        ? template.slots
        : {};
    const values: Record<string, string> = {
      attendee_name: ticket?.holderName || log.order.buyerName,
      event_title: log.event.title,
      event_date: new Intl.DateTimeFormat("en-IN", {
        dateStyle: "long",
        timeZone: log.event.timezone,
      }).format(log.event.startsAt),
      event_time: new Intl.DateTimeFormat("en-IN", {
        timeStyle: "short",
        timeZone: log.event.timezone,
      }).format(log.event.startsAt),
      venue: log.event.venueName || "Online event",
      city: log.event.city || "",
      ticket_type: ticket?.ticketType.name || "",
      quantity: String(log.order.tickets.length),
      order_id: log.orderId,
      amount_paid: formatInr(log.order.totalPaise),
      ticket_url: ticket
        ? ticketUrl(ticket.id, ticket.eventId)
        : `${process.env.APP_URL}/orders/${log.orderId}`,
      organizer_name: log.event.org.name,
      support_contact:
        log.event.org.supportEmail ||
        log.event.org.supportPhone ||
        `${process.env.APP_URL}/contact`,
      custom_note:
        typeof slots.custom_note === "string" ? slots.custom_note : "",
      custom_footer:
        typeof slots.custom_footer === "string" ? slots.custom_footer : "",
    };
    if (log.channel === "EMAIL") {
      const text = renderTemplate(
        template?.body || defaultBodies[log.trigger],
        values,
      );
      const subject = renderTemplate(
        template?.subject ||
          `${log.event.title} · ${log.trigger.toLowerCase().replaceAll("_", " ")}`,
        values,
      );
      const attachments: { filename: string; content: Buffer }[] = [];
      if (log.trigger === "TICKET_ISSUED" && ticket) {
        if (!ticket.pdfKey)
          throw new Error("Ticket PDF is still being prepared.");
        attachments.push({
          filename: `raunak-${ticket.code}.pdf`,
          content: await storage.read(ticket.pdfKey, 10 * 1024 * 1024),
        });
      }
      await providers.email.send({
        to: log.toAddress,
        subject,
        text,
        html: `<div style="font-family:Arial,sans-serif;padding:28px;background:#f4f1eb;color:#25241f"><h2 style="color:#bd452c">raunak.</h2><p style="white-space:pre-line">${escapeHtml(text)}</p></div>`,
        attachments,
        idempotencyKey: id,
      });
    } else {
      if (!log.order.whatsappOptIn)
        throw new Error("WhatsApp updates were not requested by this buyer.");
      const approved = whatsappTemplate(log.trigger);
      const result = await providers.whatsapp.sendTemplate({
        to: log.toAddress,
        templateName: approved.name,
        language: approved.language,
        params: approved.variables.map((key) => values[key] || "—"),
        notificationId: id,
      });
      await db.notificationLog.update({
        where: { id },
        data: { providerMessageId: result.providerMessageId },
      });
    }
    await db.notificationLog.updateMany({
      where: { id, status: "SENDING" },
      data: { status: "SENT", sentAt: new Date(), error: null },
    });
  } catch (error) {
    await db.notificationLog.updateMany({
      where: { id, status: "SENDING" },
      data: {
        status: log.attempts + 1 >= 5 ? "FAILED" : "QUEUED",
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Provider delivery failed.",
      },
    });
    throw error;
  }
}
export async function saveMessageTemplate(
  userId: string,
  eventId: string,
  input: unknown,
) {
  const event = await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const data = z
    .object({
      channel: z.enum(["EMAIL", "WHATSAPP"]),
      trigger: triggerSchema,
      isEnabled: z.boolean(),
      body: z.string().max(10000),
      subject: z.string().max(200).optional(),
      custom_note: z.string().max(500).default(""),
      custom_footer: z.string().max(200).default(""),
    })
    .parse(input);
  renderTemplate(data.body, {});
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const current = await tx.messageTemplate.findFirst({
      where: {
        orgId: event.orgId,
        eventId,
        channel: data.channel,
        trigger: data.trigger,
      },
    });
    const values = {
      orgId: event.orgId,
      eventId,
      channel: data.channel,
      trigger: data.trigger,
      isEnabled: data.isEnabled,
      body:
        data.channel === "WHATSAPP" ? defaultBodies[data.trigger] : data.body,
      subject: data.subject,
      slots: {
        custom_note: data.custom_note,
        custom_footer: data.custom_footer,
      } as Prisma.InputJsonValue,
    };
    const result = current
      ? await tx.messageTemplate.update({
          where: { id: current.id },
          data: values,
        })
      : await tx.messageTemplate.create({ data: values });
    await tx.auditLog.create({
      data: {
        orgId: event.orgId,
        actorId: userId,
        action: "message-template.updated",
        entityType: "MessageTemplate",
        entityId: result.id,
      },
    });
    return result;
  });
}
export async function retryNotification(
  userId: string,
  eventId: string,
  id: string,
) {
  await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  z.uuid().parse(id);
  const log = await db.notificationLog.findFirst({
    where: { id, eventId, status: "FAILED" },
  });
  if (!log) throw new Error("Failed delivery not found.");
  const job = await notificationQueue.getJob(id);
  await db.notificationLog.update({
    where: { id },
    data: { status: "QUEUED", attempts: 0, error: null },
  });
  if (job && (await job.getState()) === "failed")
    await job.retry("failed", { resetAttemptsMade: true });
  else {
    if (job) await job.remove();
    await queueNotification(id);
  }
}
export async function resendOrderNotifications(
  userId: string,
  orderId: string,
) {
  const order = await db.order.findFirst({
    where: { id: orderId, buyerId: userId, status: "PAID" },
  });
  if (!order) throw new Error("Order not found.");
  await enqueueOrderNotifications(orderId, randomUUID());
}
