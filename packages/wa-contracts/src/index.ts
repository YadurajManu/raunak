import { z } from "zod";

export const waErrorCodes = [
  "NO_CONSENT",
  "NOT_ON_WHATSAPP",
  "SUPPRESSED",
  "WA_CAP_REACHED",
  "QUIET_HOURS",
  "SESSION_DISCONNECTED",
  "SESSION_PAUSED",
  "RATE_LIMITED",
  "MEDIA_TOO_LARGE",
  "ENGINE_ERROR",
  "KILL_SWITCH",
] as const;
export type WaErrorCode = (typeof waErrorCodes)[number];
export class WaError extends Error {
  constructor(
    public code: WaErrorCode,
    public retryable = false,
    public retryAfterMs = 0,
  ) {
    super(code);
  }
}
export const transactionalTriggers = [
  "TICKET_ISSUED",
  "ORDER_CONFIRMED",
  "PAYMENT_FAILED",
  "EVENT_CANCELLED",
  "EVENT_UPDATED",
  "ATTENDEE_BROADCAST",
  "REMINDER_2H",
  "REMINDER_24H",
] as const;
export const gatewayMessageSchema = z.object({
  clientMessageId: z.string().min(1).max(160),
  orgId: z.uuid(),
  notificationId: z.uuid().optional(),
  to: z.string().min(8).max(25),
  trigger: z.enum(transactionalTriggers),
  timezone: z.string().max(80),
  text: z.string().min(1).max(12000),
  consent: z.boolean(),
  attachments: z
    .array(
      z.object({
        kind: z.enum(["image", "document"]),
        content: z.string().max(14_000_000),
        filename: z.string().max(120).optional(),
        mimetype: z.enum(["image/png", "image/jpeg", "application/pdf"]),
      }),
    )
    .max(12)
    .default([]),
});
export type GatewayMessage = z.infer<typeof gatewayMessageSchema>;
export const gatewaySessionSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  phone: z.string().nullable(),
  pushName: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  connectedAt: z.string().nullable(),
  uptimeSeconds: z.number().nonnegative(),
  qr: z.string().nullable(),
  lastError: z.string().nullable(),
});
export type SendResult = { providerMessageId: string; messageIds?: string[] };
export type SessionRecord = {
  id: string;
  authStateEnc: Uint8Array | null;
  authVersion: number;
};
export type EngineEvent =
  | {
      type: "status";
      sessionId: string;
      status:
        | "CONNECTED"
        | "CONNECTING"
        | "DISCONNECTED"
        | "LOGGED_OUT"
        | "PAUSED"
        | "BANNED_SUSPECTED";
      phoneE164?: string;
      pushName?: string;
      reason?: string;
    }
  | { type: "qr"; sessionId: string; qr: string }
  | {
      type: "receipt";
      sessionId: string;
      messageId: string;
      status: "SENT" | "DELIVERED" | "READ";
    }
  | {
      type: "inbound";
      sessionId: string;
      messageId: string;
      phoneE164: string;
      text: string;
    };
export interface WhatsAppEngine {
  start(session: SessionRecord): Promise<void>;
  stop(sessionId: string): Promise<void>;
  logout?(sessionId: string): Promise<void>;
  requestPairingCode(sessionId: string, phoneE164: string): Promise<string>;
  isOnWhatsApp(sessionId: string, phoneE164: string): Promise<boolean>;
  presence(
    sessionId: string,
    phoneE164: string,
    kind: "composing" | "paused",
  ): Promise<void>;
  sendText(sessionId: string, to: string, text: string): Promise<SendResult>;
  sendImage(
    sessionId: string,
    to: string,
    image: Buffer,
    caption?: string,
  ): Promise<SendResult>;
  sendDocument(
    sessionId: string,
    to: string,
    file: Buffer,
    fileName: string,
    mimetype: string,
    caption?: string,
  ): Promise<SendResult>;
  on(event: EngineEvent["type"], handler: (event: EngineEvent) => void): void;
}
