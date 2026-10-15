import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { db } from "@/server/db/client";
import {
  Prisma,
  type Channel,
  type MessageTrigger,
} from "@/generated/prisma/client";
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
  triggerSchema,
  whatsappTemplate,
} from "./templates";
import { formatInr } from "@/lib/money";
import QRCode from "qrcode";
import { emailMarkup } from "./email-markup";
import { WaError, transactionalTriggers } from "@raunak/wa-contracts";
import { resolveWhatsApp } from "@/server/whatsapp/routing";
import { ticketCard, eventPoster } from "@/server/tickets/card";
import type { GatewayMessage } from "@raunak/wa-contracts";
import sharp from "sharp";
import { messageAccess } from "./access";
import { attachmentSettingsSchema } from "@/lib/whatsapp";

export async function resolvedTemplate(
  orgId: string,
  eventId: string | null,
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
        priority: transactionalTriggers.indexOf(log.trigger) + 1,
        backoff: { type: "exponential", delay: 5000, jitter: 0.2 },
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
      order: {
        include: {
          tickets: {
            include: { ticketType: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
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
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
        timeZone: log.event.timezone,
      }).format(log.event.startsAt),
      venue:
        [
          log.event.venueName,
          log.event.address && log.event.address !== log.event.venueName
            ? log.event.address
            : null,
        ]
          .filter(Boolean)
          .join(", ") ||
        (log.event.mode === "ONLINE"
          ? "Online event"
          : "Venue to be announced"),
      city: log.event.city || "",
      ticket_type: ticket?.ticketType.name || "",
      ticket_code: ticket?.code || "",
      quantity: String(log.order.tickets.length),
      order_id: log.orderId,
      amount_paid: formatInr(log.order.totalPaise),
      ticket_url:
        ticket && log.trigger !== "ORDER_CONFIRMED"
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
      const attachments: {
        filename: string;
        content: Buffer;
        contentId?: string;
      }[] = [];
      if (log.trigger === "TICKET_ISSUED" && ticket) {
        if (!ticket.pdfKey)
          throw new Error("Ticket PDF is still being prepared.");
        attachments.push({
          filename: `raunak-${ticket.code}.pdf`,
          content: await storage.read(ticket.pdfKey, 10 * 1024 * 1024),
        });
        attachments.push({
          filename: `raunak-${ticket.code}-qr.png`,
          content: await QRCode.toBuffer(ticketUrl(ticket.id, ticket.eventId), {
            width: 440,
            margin: 3,
            errorCorrectionLevel: "M",
          }),
          contentId: "ticket-qr",
        });
      }
      await providers.email.send({
        to: log.toAddress,
        subject,
        text,
        html: emailMarkup(
          template?.body ||
            !["ORDER_CONFIRMED", "TICKET_ISSUED"].includes(log.trigger)
            ? text
            : `Hi ${values.attendee_name}, ${log.trigger === "TICKET_ISSUED" ? "your ticket is ready. Save the attached PDF for offline entry, or open your ticket below." : "your booking is confirmed. Your entry tickets will arrive in a separate email and are also available in your ticket wallet."}\n${values.custom_note}\n${values.custom_footer}`,
          values,
          log.trigger === "TICKET_ISSUED" && !!ticket,
          log.trigger,
        ),
        attachments,
        idempotencyKey: id,
      });
    } else {
      if (!log.order.whatsappOptIn) throw new WaError("NO_CONSENT");
      const route =
        providers.whatsapp !== whatsapp
          ? { kind: "official" as const, provider: providers.whatsapp }
          : await resolveWhatsApp(log.orgId);
      if (route.kind === "gateway") {
        const attachments: GatewayMessage["attachments"] = [];
        const options = attachmentSettingsSchema.parse(
          template?.attachments || {},
        );
        const largeOrder =
          log.trigger === "TICKET_ISSUED" && log.order.tickets.length > 10;
        if (largeOrder && ticket?.id !== log.order.tickets[0]?.id) {
          await db.notificationLog.update({
            where: { id },
            data: {
              status: "SKIPPED",
              error:
                "Large booking delivered in one WhatsApp message with its order link.",
            },
          });
          return;
        }
        if (log.trigger === "TICKET_ISSUED" && ticket && !largeOrder) {
          if (options.ticketCard)
            attachments.push({
              kind: "image",
              mimetype: "image/png",
              content: (await ticketCard(ticket.id)).toString("base64"),
            });
          if (options.ticketPdf) {
            if (!ticket.pdfKey)
              throw new Error("Ticket PDF is still being prepared.");
            attachments.push({
              kind: "document",
              mimetype: "application/pdf",
              filename: `ticket-${ticket.code}.pdf`,
              content: (
                await storage.read(ticket.pdfKey, 10 * 1024 * 1024)
              ).toString("base64"),
            });
          }
        } else if (options.poster) {
          const poster = await eventPoster(log.eventId);
          if (poster)
            attachments.push({
              kind: "image",
              mimetype: "image/jpeg",
              content: (
                await sharp(poster)
                  .resize(1080, 1080, {
                    fit: "inside",
                    withoutEnlargement: true,
                  })
                  .jpeg({ quality: 75 })
                  .toBuffer()
              ).toString("base64"),
            });
        }
        const firstTicket =
          log.trigger !== "TICKET_ISSUED" ||
          ticket?.id === log.order.tickets[0]?.id;
        const rendered = firstTicket
          ? renderTemplate(template?.body || defaultBodies[log.trigger], values)
          : "";
        const text =
          rendered +
          (firstTicket && !template?.body
            ? "\n\nReply STOP to stop WhatsApp updates."
            : "");
        const fallback = largeOrder
          ? `${process.env.APP_URL}/orders/${log.orderId}`
          : values.ticket_url;
        const result = await route.provider.send(route.sessionId, {
          clientMessageId: id,
          notificationId: id,
          orgId: log.orgId,
          to: log.toAddress,
          trigger: log.trigger,
          timezone: log.event.timezone,
          consent: log.order.whatsappOptIn,
          text: (text.includes(fallback) ? text : `${text}\n\n${fallback}`)
            .replace(/\n{3,}/g, "\n\n")
            .trim(),
          attachments,
        });
        await db.notificationLog.update({
          where: { id },
          data: {
            sessionId: route.sessionId,
            providerMessageId: result.providerMessageId,
            errorCode: null,
          },
        });
      } else {
        const approved = whatsappTemplate(log.trigger);
        let document: { filename: string; content: Buffer } | undefined;
        if (approved.documentHeader) {
          if (log.trigger !== "TICKET_ISSUED" || !ticket?.pdfKey)
            throw new Error(
              "A prepared ticket PDF is required for this WhatsApp template.",
            );
          document = {
            filename: `raunak-${ticket.code}.pdf`,
            content: await storage.read(ticket.pdfKey, 10 * 1024 * 1024),
          };
        }
        const result = await route.provider.sendTemplate({
          to: log.toAddress,
          templateName: approved.name,
          language: approved.language,
          params: approved.variables.map((key) => values[key] || "—"),
          notificationId: id,
          document,
        });
        await db.notificationLog.update({
          where: { id },
          data: { providerMessageId: result.providerMessageId },
        });
      }
    }
    await db.notificationLog.updateMany({
      where: { id, status: "SENDING" },
      data: { status: "SENT", sentAt: new Date(), error: null },
    });
  } catch (error) {
    if (error instanceof WaError) {
      const deferred =
        ["WA_CAP_REACHED", "QUIET_HOURS"].includes(error.code) &&
        error.retryable;
      const skipped = [
        "NO_CONSENT",
        "NOT_ON_WHATSAPP",
        "SUPPRESSED",
        "KILL_SWITCH",
        "SESSION_DISCONNECTED",
      ].includes(error.code);
      await db.notificationLog.updateMany({
        where: { id, status: "SENDING" },
        data: {
          status: skipped
            ? "SKIPPED"
            : error.retryable && (deferred || log.attempts + 1 < 5)
              ? "QUEUED"
              : "FAILED",
          errorCode: error.code,
          error: error.code,
          ...(deferred
            ? {
                attempts: { decrement: 1 },
                scheduledAt: new Date(Date.now() + error.retryAfterMs),
              }
            : {}),
        },
      });
      if (!error.retryable || skipped) return;
      throw error;
    }
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
  eventId: string | null,
  input: unknown,
  orgId?: string,
) {
  const event = await messageAccess(userId, eventId, orgId);
  const organization = await db.organization.findUniqueOrThrow({
    where: { id: event.orgId },
    select: { whatsappMode: true },
  });
  const data = z
    .object({
      channel: z.enum(["EMAIL", "WHATSAPP"]),
      trigger: triggerSchema,
      isEnabled: z.boolean(),
      body: z.string().trim().min(1).max(10000),
      subject: z.string().max(200).optional(),
      custom_note: z.string().max(500).default(""),
      custom_footer: z.string().max(200).default(""),
      attachments: attachmentSettingsSchema.default({
        ticketCard: true,
        ticketPdf: false,
        poster: false,
      }),
    })
    .parse(input);
  renderTemplate(data.body, {});
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${event.orgId}::uuid FOR UPDATE`;
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
        data.channel === "WHATSAPP" &&
        !["ORG_NUMBER", "PLATFORM_NUMBER"].includes(organization.whatsappMode)
          ? defaultBodies[data.trigger]
          : data.body,
      attachments: data.attachments,
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
  eventId: string | null,
  id: string,
  orgId?: string,
) {
  const scope = await messageAccess(userId, eventId, orgId);
  z.uuid().parse(id);
  const log = await db.notificationLog.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      ...(eventId ? { eventId } : {}),
      status: "FAILED",
    },
  });
  if (!log) throw new Error("Failed delivery not found.");
  const job = await notificationQueue.getJob(id);
  await db.notificationLog.update({
    where: { id },
    data: { status: "QUEUED", attempts: 0, error: null, errorCode: null },
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
