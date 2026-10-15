import { z } from "zod";
export const defaultAttachments = { ticketCard: true, ticketPdf: false, poster: false };
export const attachmentSettingsSchema = z.object({ ticketCard: z.boolean().default(true), ticketPdf: z.boolean().default(false), poster: z.boolean().default(false) });
export const waErrorMessages: Record<string, string> = {
  NO_CONSENT: "This buyer did not request WhatsApp updates. Email remains available.",
  NOT_ON_WHATSAPP: "This number is not registered on WhatsApp. The ticket is sent by email.",
  SUPPRESSED: "WhatsApp updates were stopped for this number.",
  WA_CAP_REACHED: "The sending limit was reached. Delivery is scheduled for the next window.",
  QUIET_HOURS: "This reminder will be sent after quiet hours end.",
  SESSION_DISCONNECTED: "The WhatsApp number is disconnected. Re-link it in integration settings.",
  SESSION_PAUSED: "Sending is paused. Check the connection before resuming.",
  RATE_LIMITED: "Please wait before trying again.",
  MEDIA_TOO_LARGE: "An attachment is invalid or too large to send.",
  ENGINE_ERROR: "WhatsApp delivery could not be confirmed. Check the connection and delivery history before retrying.",
  KILL_SWITCH: "WhatsApp delivery is switched off. Email delivery continues.",
};
