import { z } from "zod";
import { MessageTrigger } from "@/generated/prisma/enums";
export const variables = [
  "attendee_name",
  "event_title",
  "event_date",
  "event_time",
  "venue",
  "city",
  "ticket_type",
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
export function renderTemplate(body: string, values: Record<string, string>) {
  return body.replace(/{{\s*([^{}]+?)\s*}}/g, (_match, rawKey: string) => {
    const key = rawKey.trim();
    if (!(variables as readonly string[]).includes(key))
      throw new Error(`Unsupported variable: ${key}`);
    return values[key] || "";
  });
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
    "Hi {{attendee_name}}, your booking for {{event_title}} is confirmed. {{quantity}} ticket(s), total {{amount_paid}}. Order {{order_id}}.\n{{ticket_url}}\n{{custom_note}}\n{{custom_footer}}",
  TICKET_ISSUED:
    "Hi {{attendee_name}}, here is your {{ticket_type}} ticket for {{event_title}}.\n{{event_date}} at {{event_time}} · {{venue}}\nYour entry ticket: {{ticket_url}}\n{{custom_note}}\n{{custom_footer}}",
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
};
const metaConfig = z.record(
  z.string(),
  z.object({
    name: z.string().regex(/^[a-z0-9_]+$/),
    language: z.string().min(2),
    variables: z.array(z.enum(variables)).max(30),
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
