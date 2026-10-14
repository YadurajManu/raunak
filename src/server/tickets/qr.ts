import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
function signingSecret() {
  return z.string().min(32).parse(process.env.TICKET_SIGNING_SECRET);
}
export function ticketToken(ticketId: string, eventId: string) {
  z.uuid().parse(ticketId);
  z.uuid().parse(eventId);
  const signature = createHmac("sha256", signingSecret())
    .update(`v1.${ticketId}.${eventId}`)
    .digest("base64url");
  return `v1.${ticketId}.${signature}`;
}
export function tokenTicketId(token: string) {
  return /^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(token)
    ? z.uuid().safeParse(token.split(".")[1]).data || null
    : null;
}
export function verifyTicketToken(token: string, eventId: string) {
  const id = tokenTicketId(token);
  if (!id) return false;
  const expected = Buffer.from(ticketToken(id, eventId));
  const actual = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function ticketUrl(ticketId: string, eventId: string) {
  return `${z.url().parse(process.env.APP_URL).replace(/\/$/, "")}/t/${ticketToken(ticketId, eventId)}`;
}
