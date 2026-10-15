import { createHash } from "node:crypto";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { db } from "@/server/db/client";
import { APP_NAME } from "@/lib/constants";
import { ticketUrl } from "@/server/tickets/qr";
import { encryptState, decryptState } from "./security";
import type { EngineEvent } from "@raunak/wa-contracts";
export const inboundPayload = z.object({
  sessionId: z.uuid(),
  command: z.enum(["STOP", "TICKET", "OTHER"]),
  phoneEnc: z.string().optional(),
  retryAt: z.number().default(0),
  attempts: z.number().int().default(0),
});
export function command(text: string) {
  const normalized = text
    .trim()
    .toLocaleLowerCase("en-IN")
    .replace(/[.!।]+$/, "");
  if (
    [
      "stop",
      "unsubscribe",
      "band",
      "band karo",
      "बंद",
      "बंद करो",
      "रोकें",
      "rok do",
    ].includes(normalized)
  )
    return "STOP" as const;
  if (["ticket", "my ticket"].includes(normalized)) return "TICKET" as const;
  return "OTHER" as const;
}
export async function acceptInbound(
  event: Extract<EngineEvent, { type: "inbound" }>,
) {
  const sender = parsePhoneNumberFromString(event.phoneE164);
  if (!sender?.isValid() || sender.number !== event.phoneE164) return;
  const session = await db.whatsAppSession.findUniqueOrThrow({
    where: { id: event.sessionId },
  });
  const kind = command(event.text),
    key = createHash("sha256")
      .update(`${session.id}:${event.messageId}`)
      .digest("hex");
  const payload = {
    sessionId: session.id,
    command: kind,
    retryAt: 0,
    attempts: 0,
    ...(kind !== "OTHER"
      ? {
          phoneEnc: encryptState(
            sender.number,
            process.env.ENCRYPTION_KEY || "",
            session.id,
          ).toString("base64"),
        }
      : {}),
  };
  await db.$transaction(async (tx) => {
    const created = await tx.webhookEvent.createMany({
      data: {
        provider: "baileys-inbound",
        idempotencyKey: key,
        payload,
        ...(kind === "OTHER"
          ? { status: "PROCESSED", processedAt: new Date() }
          : {}),
      },
      skipDuplicates: true,
    });
    if (!created.count || kind !== "STOP") return;
    await tx.whatsAppSuppression.createMany({
      data: {
        orgId: session.orgId,
        phoneE164: sender.number,
        reason: "STOP_REPLY",
      },
      skipDuplicates: true,
    });
    await tx.whatsAppSuppression.updateMany({
      where: { orgId: session.orgId, phoneE164: sender.number },
      data: { reason: "STOP_REPLY" },
    });
  });
}
export function replyPhone(payload: z.infer<typeof inboundPayload>) {
  if (!payload.phoneEnc) throw new Error("Missing reply recipient");
  return decryptState(
    Buffer.from(payload.phoneEnc, "base64"),
    process.env.ENCRYPTION_KEY || "",
    payload.sessionId,
  );
}
export async function ticketReply(sessionId: string, phone: string) {
  const session = await db.whatsAppSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  const numbers = [phone, ...(phone.startsWith("+91") ? [phone.slice(3)] : [])];
  const order = await db.order.findFirst({
    where: {
      status: "PAID",
      buyerPhone: { in: numbers },
      tickets: { some: { status: "VALID" } },
      event: {
        orgId: session.orgId || undefined,
        org: { whatsappMode: session.orgId ? "ORG_NUMBER" : "PLATFORM_NUMBER" },
        status: "PUBLISHED",
        deletedAt: null,
        endsAt: { gt: new Date() },
      },
    },
    include: {
      tickets: {
        where: { status: "VALID" },
        orderBy: { createdAt: "asc" },
        take: 11,
      },
      event: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!order)
    return `${APP_NAME}: no upcoming valid tickets are linked to this WhatsApp number. Sign in to your ticket wallet or contact the organizer: ${process.env.APP_URL}/my-tickets`;
  const links =
    order.tickets.length > 10
      ? [`${process.env.APP_URL}/orders/${order.id}`]
      : order.tickets.map((ticket) => ticketUrl(ticket.id, ticket.eventId));
  return `${order.event.title}\nYour latest valid ticket${links.length === 1 ? "" : "s"}:\n${links.join("\n")}\nKeep these links private.`;
}
