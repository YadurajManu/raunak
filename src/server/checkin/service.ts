import { z } from "zod";
import { db } from "@/server/db/client";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { tokenTicketId, verifyTicketToken } from "@/server/tickets/qr";
const roles = ["OWNER", "ADMIN", "MANAGER", "CHECKIN"] as const;
export async function searchAttendees(userId: string, input: unknown) {
  const data = z.object({ eventId: z.uuid(), q: z.string().trim().min(2).max(100) }).parse(input);
  await requireEventAccessForUser(userId, data.eventId, [...roles]);
  return db.ticket.findMany({ where: { eventId: data.eventId, order: { status: "PAID" }, OR: [{ holderName: { contains: data.q, mode: "insensitive" } }, { holderEmail: { contains: data.q, mode: "insensitive" } }, { holderPhone: { contains: data.q } }, { code: { contains: data.q, mode: "insensitive" } }] }, select: { id: true, holderName: true, holderEmail: true, holderPhone: true, code: true, status: true, ticketType: { select: { name: true } } }, take: 50 });
}
function parseScan(value: string) {
  if (value.startsWith("v1.")) return value;
  try { const url = new URL(value); if (url.origin !== new URL(process.env.APP_URL!).origin || !url.pathname.startsWith("/t/")) return ""; return decodeURIComponent(url.pathname.slice(3)); } catch { return ""; }
}
export async function checkIn(userId: string, input: unknown) {
  const data = z.object({ eventId: z.uuid(), token: z.string().max(4096).optional(), ticketId: z.uuid().optional() }).refine(x => Boolean(x.token) !== Boolean(x.ticketId), "Choose a scanned QR or an attendee.").parse(input);
  const access = await requireEventAccessForUser(userId, data.eventId, [...roles]);
  const token = data.token ? parseScan(data.token) : "";
  const id = data.ticketId || tokenTicketId(token);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${data.eventId}::uuid FOR SHARE`;
    const event = await tx.event.findUniqueOrThrow({ where: { id: data.eventId }, select: { status: true, deletedAt: true } });
    const ticket = id ? await tx.ticket.findFirst({ where: { id, eventId: data.eventId }, include: { order: { select: { status: true } } } }) : null;
    let result: "VALID" | "ALREADY_USED" | "INVALID" = "INVALID";
    if (ticket && ticket.order.status === "PAID" && event.status === "PUBLISHED" && !event.deletedAt && (!data.token || verifyTicketToken(token, data.eventId))) {
      const updated = await tx.ticket.updateMany({ where: { id: ticket.id, eventId: data.eventId, status: "VALID" }, data: { status: "USED", checkedInAt: new Date(), checkedInById: userId } });
      if (updated.count) result = "VALID"; else if (ticket.status === "USED" || (await tx.ticket.findUnique({ where: { id: ticket.id }, select: { status: true } }))?.status === "USED") result = "ALREADY_USED";
    }
    await tx.auditLog.create({ data: { orgId: access.orgId, actorId: userId, action: `checkin.${result.toLowerCase()}`, entityType: "Ticket", entityId: ticket?.id || data.eventId, meta: { eventId: data.eventId, result } } });
    const detail = result !== "INVALID" && ticket ? await tx.ticket.findUnique({ where: { id: ticket.id }, select: { id: true, holderName: true, code: true, checkedInAt: true, checkedInBy: { select: { name: true } }, ticketType: { select: { name: true } } } }) : null;
    return { result, ticket: detail };
  });
}
