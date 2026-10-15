import { z } from "zod";
import { db } from "@/server/db/client";
import { messageAccess } from "./access";
import {
  defaultBodies,
  renderTemplate,
  triggerSchema,
  whatsappTemplate,
} from "./templates";
import { resolvedTemplate } from "./service";
import { sendEmail } from "@/server/providers/email/provider";
import { whatsapp } from "@/server/providers/whatsapp/provider";
import { resolveWhatsApp } from "@/server/whatsapp/routing";
import { producerConnection } from "../../../worker/queues";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { APP_NAME } from "@/lib/constants";
import { renderTicketCard, eventPoster } from "@/server/tickets/card";
import { attachmentSettingsSchema } from "@/lib/whatsapp";
export async function resetMessageTemplate(
  userId: string,
  eventId: string | null,
  input: unknown,
  orgId?: string,
) {
  const event = await messageAccess(userId, eventId, orgId);
  const data = z
    .object({ channel: z.enum(["EMAIL", "WHATSAPP"]), trigger: triggerSchema })
    .parse(input);
  await db.$transaction(async (tx) => {
    await tx.messageTemplate.deleteMany({
      where: {
        orgId: event.orgId,
        eventId,
        channel: data.channel,
        trigger: data.trigger,
      },
    });
    await tx.auditLog.create({
      data: {
        orgId: event.orgId,
        actorId: userId,
        action: "message-template.reset",
        entityType: eventId ? "Event" : "Organization",
        entityId: eventId || event.orgId,
      },
    });
  });
}
export async function sendMessageTest(
  userId: string,
  eventId: string | null,
  input: unknown,
  orgId?: string,
) {
  const access = await messageAccess(userId, eventId, orgId);
  const count = Number(
    await producerConnection.eval(
      `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n`,
      1,
      `wa:template-test:${access.orgId}:${userId}`,
    ),
  );
  if (count > 3)
    throw new Error("Please wait a minute before sending another test.");
  const data = z
    .object({ channel: z.enum(["EMAIL", "WHATSAPP"]), trigger: triggerSchema })
    .parse(input);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const event = await db.event.findFirst({
    where: {
      ...(eventId ? { id: eventId } : {}),
      orgId: access.orgId,
      deletedAt: null,
    },
    include: { org: true },
    orderBy: { createdAt: "desc" },
  });
  if (!event)
    throw new Error("Create an event before sending a template test.");
  const template = await resolvedTemplate(
    access.orgId,
    eventId,
    data.trigger,
    data.channel,
  );
  const slots =
    template?.slots &&
    typeof template.slots === "object" &&
    !Array.isArray(template.slots)
      ? template.slots
      : {};
  const values: Record<string, string> = {
    attendee_name: user.name || "Organizer",
    event_title: event.title,
    event_date: new Intl.DateTimeFormat("en-IN", {
      dateStyle: "long",
      timeZone: event.timezone,
    }).format(event.startsAt),
    event_time: new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: event.timezone,
    }).format(event.startsAt),
    venue:
      [
        event.venueName,
        event.address && event.address !== event.venueName
          ? event.address
          : null,
      ]
        .filter(Boolean)
        .join(", ") ||
      (event.mode === "ONLINE" ? "Online event" : "Venue to be announced"),
    city: event.city || "",
    ticket_type: "TEST PREVIEW",
    ticket_code: "SAMPLE",
    quantity: "1",
    order_id: "TEST ONLY",
    amount_paid: "Preview only",
    ticket_url: `${process.env.APP_URL}/e/${event.slug}`,
    organizer_name: event.org.name,
    support_contact: event.org.supportEmail || `${process.env.APP_URL}/contact`,
    custom_note: String(
      slots.custom_note || "Test preview; this message does not admit entry.",
    ),
    custom_footer: String(slots.custom_footer || `${APP_NAME} test`),
  };
  if (data.channel === "EMAIL")
    await sendEmail({
      to: user.email,
      subject: `[TEST] ${event.title}`,
      text: renderTemplate(
        template?.body || defaultBodies[data.trigger],
        values,
      ),
    });
  else {
    if (!user.phone)
      throw new Error(
        "Add your phone number to your profile before sending a WhatsApp test.",
      );
    const route = await resolveWhatsApp(event.orgId);
    if (route.kind === "gateway") {
      const phone = parsePhoneNumberFromString(user.phone, "IN");
      if (!phone?.isValid())
        throw new Error("Add a valid mobile number to your profile.");
      const options = attachmentSettingsSchema.parse(
        template?.attachments || {},
      );
      const message = {
        orgId: event.orgId,
        clientMessageId: `template-test:${crypto.randomUUID()}`,
        trigger: data.trigger,
        timezone: event.timezone,
        to: phone.number,
        consent: true,
        text: `[TEST — NO ENTRY]\n${renderTemplate(template?.body || defaultBodies[data.trigger], values)}\n${values.ticket_url}`,
        attachments: [],
      };
      if (data.trigger === "TICKET_ISSUED" && options.ticketCard) {
        const card = await renderTicketCard({
          title: event.title,
          date: `${values.event_date} · ${values.event_time}`,
          venue: values.venue,
          holder: values.attendee_name,
          organizer: event.org.name,
          poster: await eventPoster(event.id),
          type: "Sample ticket",
          code: "SAMPLE",
          url: values.ticket_url,
          sample: true,
        });
        await route.provider.sendImage(route.sessionId, message, card);
      } else await route.provider.send(route.sessionId, message);
    } else {
      const approved = whatsappTemplate(data.trigger);
      if (approved.documentHeader)
        throw new Error(
          "Use a paid order's Resend tickets action to test a ticket PDF. Template previews do not create entry tickets.",
        );
      await whatsapp.sendTemplate({
        to: user.phone,
        templateName: approved.name,
        language: approved.language,
        params: approved.variables.map((key) => values[key] || "—"),
        notificationId: crypto.randomUUID(),
      });
    }
  }
  await db.auditLog.create({
    data: {
      orgId: event.orgId,
      actorId: userId,
      action: "message-template.test-sent",
      entityType: eventId ? "Event" : "Organization",
      entityId: eventId || event.orgId,
      meta: data,
    },
  });
}
