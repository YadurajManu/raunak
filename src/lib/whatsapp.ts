import { z } from "zod";
export const defaultAttachments = {
  ticketCard: true,
  ticketPdf: false,
  poster: false,
};
export const attachmentSettingsSchema = z.object({
  ticketCard: z.boolean().default(true),
  ticketPdf: z.boolean().default(false),
  poster: z.boolean().default(false),
});
export const waErrorMessages: Record<string, string> = {
  NO_CONSENT:
    "This buyer did not request WhatsApp updates. Email remains available.",
  NOT_ON_WHATSAPP:
    "This number is not registered on WhatsApp. The ticket is sent by email.",
  SUPPRESSED: "WhatsApp updates were stopped for this number.",
  WA_CAP_REACHED:
    "The sending limit was reached. Delivery is scheduled for the next window.",
  QUIET_HOURS: "This reminder will be sent after quiet hours end.",
  SESSION_DISCONNECTED:
    "The WhatsApp number is disconnected. Re-link it in integration settings.",
  SESSION_PAUSED: "Sending is paused. Check the connection before resuming.",
  RATE_LIMITED: "Please wait before trying again.",
  MEDIA_TOO_LARGE: "An attachment is invalid or too large to send.",
  ENGINE_ERROR:
    "WhatsApp delivery could not be confirmed. Check the connection and delivery history before retrying.",
  KILL_SWITCH: "WhatsApp delivery is switched off. Email delivery continues.",
  AUTH_PERSIST_FAILED:
    "Session credentials could not be saved. Sending is paused; ask the server administrator to check storage and encryption settings.",
  CONNECTION_REPLACED:
    "Another device replaced this connection. Resolve the competing connection before re-linking.",
  BAD_SESSION:
    "The saved connection is invalid. Re-link your dedicated number.",
  LOGGED_OUT: "WhatsApp unlinked this device. Re-link to resume delivery.",
  BANNED_SUSPECTED:
    "WhatsApp restricted or refused this connection. Sending is stopped; review the number before re-linking.",
  CIRCUIT_BREAKER:
    "Repeated delivery failures paused sending. Check WhatsApp and use Connect to run a health check.",
  RECONNECT_FAILED:
    "Reconnection failed. Check the server connection and re-link if needed.",
  RECONNECTING: "Reconnecting to WhatsApp. Email delivery continues.",
  GATEWAY_UNREACHABLE:
    "The private WhatsApp gateway is unreachable. Email delivery continues; contact your administrator.",
};
