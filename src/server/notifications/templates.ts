import { z } from "zod";
import { MessageTrigger } from "@/generated/prisma/enums";
export const variables = [
  "attendee_name",
  "event_title",
  "event_date",
  "event_time",
  "event_url",
  "venue",
  "city",
  "ticket_type",
  "ticket_code",
  "quantity",
  "order_id",
  "amount_paid",
  "ticket_url",
  "organizer_name",
  "support_contact",
  "custom_note",
  "custom_footer",
] as const;
export const triggerSchema = z.enum(MessageTrigger);
export const messageTemplateTriggerSchema = z.enum([
  "ORDER_CONFIRMED",
  "TICKET_ISSUED",
  "PAYMENT_FAILED",
  "REMINDER_24H",
  "REMINDER_2H",
  "EVENT_UPDATED",
  "EVENT_CANCELLED",
]);
export function renderTemplate(body: string, values: Record<string, string>) {
  return body.replace(/{{\s*([^{}]+?)\s*}}/g, (_match, rawKey: string) => {
    const key = rawKey.trim();
    if (!(variables as readonly string[]).includes(key))
      throw new Error(`Unsupported variable: ${key}`);
    return values[key] || "";
  });
}

export const broadcastVariables = [
  "attendee_name",
  "event_title",
  "event_date",
  "event_time",
  "venue",
  "city",
  "organizer_name",
  "event_url",
] as const;

export function validateBroadcastBody(body: string) {
  const used = [...body.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map((match) =>
    match[1].trim(),
  );
  if (used.some((key) => !(broadcastVariables as readonly string[]).includes(key)))
    throw new Error("Use only attendee and event details in broadcast messages.");
  return body;
}
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
export const defaultBodies: Record<MessageTrigger, string> = {
  ORDER_CONFIRMED:
    "Raunak · Booking confirmed\n\nHi {{attendee_name}}, you’re on the list!\n\n{{event_title}}\n{{event_date}} · {{event_time}}\n{{venue}} · {{city}}\nHosted by {{organizer_name}}\n\n{{quantity}} ticket(s) · Paid {{amount_paid}}\nBooking reference: {{order_id}}\n\nYour booking & tickets:\n{{ticket_url}}\n\n{{custom_note}}\n{{custom_footer}}\nNeed a hand? {{support_contact}}",
  TICKET_ISSUED:
    "Raunak · Your way in\n\nHi {{attendee_name}}, your ticket is ready.\n\n{{event_title}}\n{{event_date}} · {{event_time}}\n{{venue}} · {{city}}\nHosted by {{organizer_name}}\n\n{{ticket_type}} · {{ticket_code}}\nShow your ticket’s QR at entry. Each admission ticket has its own QR; keep it private.\n\nOpen your ticket:\n{{ticket_url}}\n\n{{custom_note}}\n{{custom_footer}}\nNeed a hand? {{support_contact}}",
  PAYMENT_FAILED:
    "Your payment for {{event_title}} was not completed. No tickets have been issued. You can try a new booking. Order {{order_id}}.\n{{custom_note}}\n{{support_contact}}",
  REMINDER_24H:
    "Tomorrow: {{event_title}}.\n{{event_date}} at {{event_time}} · {{venue}}\nYour ticket: {{ticket_url}}\n{{custom_note}}",
  REMINDER_2H:
    "See you soon at {{event_title}}.\n{{event_time}} · {{venue}}\nYour ticket: {{ticket_url}}\n{{custom_note}}",
  EVENT_UPDATED:
    "An update for {{event_title}}: {{event_date}} at {{event_time}}, {{venue}}.\nCheck your ticket for the latest details: {{ticket_url}}\n{{custom_note}}\n{{support_contact}}",
  EVENT_CANCELLED:
    "{{event_title}} has been cancelled. Please contact {{support_contact}} for the organizer's refund policy and next steps.\n{{custom_note}}",
  ATTENDEE_BROADCAST: "{{custom_note}}",
};
const metaConfig = z.record(
  z.string(),
  z.object({
    name: z.string().regex(/^[a-z0-9_]+$/),
    language: z.string().min(2),
    variables: z.array(z.enum(variables)).max(30),
    documentHeader: z.boolean().default(false),
  }),
);
export function whatsappTemplate(trigger: MessageTrigger) {
  const config = metaConfig.parse(
    JSON.parse(process.env.WHATSAPP_TEMPLATE_MAP || "{}"),
  );
  const template = config[trigger];
  if (!template)
    throw new Error(
      `No approved WhatsApp template is configured for ${trigger}.`,
    );
  return template;
}
