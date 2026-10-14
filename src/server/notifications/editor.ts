import { z } from "zod";
import { db } from "@/server/db/client";
import { requireEventAccessForUser } from "@/server/rbac/access";
import {
  defaultBodies,
  renderTemplate,
  triggerSchema,
  whatsappTemplate,
} from "./templates";
import { resolvedTemplate } from "./service";
import { sendEmail } from "@/server/providers/email/provider";
import { whatsapp } from "@/server/providers/whatsapp/provider";
export async function resetMessageTemplate(
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
        entityType: "Event",
        entityId: eventId,
      },
    });
  });
}
export async function sendMessageTest(
  userId: string,
  eventId: string,
  input: unknown,
) {
  const access = await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const data = z
    .object({ channel: z.enum(["EMAIL", "WHATSAPP"]), trigger: triggerSchema })
    .parse(input);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { org: true },
  });
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
      timeStyle: "short",
      timeZone: event.timezone,
    }).format(event.startsAt),
    venue: event.venueName || "Online event",
    city: event.city || "",
    ticket_type: "TEST PREVIEW",
    quantity: "1",
    order_id: "TEST ONLY",
    amount_paid: "Preview only",
    ticket_url: `${process.env.APP_URL}/e/${event.slug}`,
    organizer_name: event.org.name,
    support_contact: event.org.supportEmail || `${process.env.APP_URL}/contact`,
    custom_note: String(
      slots.custom_note || "Test preview; this message does not admit entry.",
    ),
    custom_footer: String(slots.custom_footer || "Raunak test"),
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
    const approved = whatsappTemplate(data.trigger);
    await whatsapp.sendTemplate({
      to: user.phone,
      templateName: approved.name,
      language: approved.language,
      params: approved.variables.map((key) => values[key] || "—"),
      notificationId: crypto.randomUUID(),
    });
  }
  await db.auditLog.create({
    data: {
      orgId: event.orgId,
      actorId: userId,
      action: "message-template.test-sent",
      entityType: "Event",
      entityId: eventId,
      meta: data,
    },
  });
}
