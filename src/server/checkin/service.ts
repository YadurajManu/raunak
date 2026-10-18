import { z } from "zod";
import { db } from "@/server/db/client";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { tokenTicketId, verifyTicketToken } from "@/server/tickets/qr";
const roles = ["OWNER", "ADMIN", "MANAGER", "CHECKIN"] as const;
export async function searchAttendees(userId: string, input: unknown) {
  const data = z
    .object({ eventId: z.uuid(), q: z.string().trim().min(2).max(100) })
    .parse(input);
  await requireEventAccessForUser(userId, data.eventId, [...roles]);
  return db.ticket.findMany({
    where: {
      eventId: data.eventId,
      OR: [
        { holderName: { contains: data.q, mode: "insensitive" } },
        { holderEmail: { contains: data.q, mode: "insensitive" } },
        { holderPhone: { contains: data.q } },
        { code: { contains: data.q, mode: "insensitive" } },
        ...(z.uuid().safeParse(data.q).success ? [{ orderId: data.q }] : []),
      ],
    },
    select: {
      id: true,
      holderName: true,
      holderEmail: true,
      holderPhone: true,
      code: true,
      status: true,
      checkedInAt: true,
      order: { select: { status: true } },
      ticketType: { select: { name: true } },
    },
    orderBy: [{ holderName: "asc" }, { id: "asc" }],
    take: 50,
  });
}
function parseScan(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("v1.")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (
      url.origin !== new URL(process.env.APP_URL!).origin ||
      !/^\/t\/[^/]+\/?$/.test(url.pathname)
    )
      return "";
    return decodeURIComponent(url.pathname.slice(3).replace(/\/$/, ""));
  } catch {
    return "";
  }
}
export async function checkIn(userId: string, input: unknown) {
  const data = z
    .object({
      eventId: z.uuid(),
      token: z.string().trim().min(1).max(4096).optional(),
      ticketId: z.uuid().optional(),
    })
    .refine(
      (x) => Boolean(x.token) !== Boolean(x.ticketId),
      "Choose a scanned QR or an attendee.",
    )
    .parse(input);
  const access = await requireEventAccessForUser(userId, data.eventId, [
    ...roles,
  ]);
  const token = data.token ? parseScan(data.token) : "";
  const id = data.ticketId || tokenTicketId(token);
  const authentic =
    !data.token || (!!id && verifyTicketToken(token, data.eventId));
  return db.$transaction(async (tx) => {
    // Use the same lock order as refunds and payments: order, event, ticket.
    const candidate =
      id && authentic
        ? await tx.ticket.findFirst({
            where: { id, eventId: data.eventId },
            select: { orderId: true },
          })
        : null;
    if (candidate)
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${candidate.orderId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${data.eventId}::uuid FOR SHARE`;
    const event = await tx.event.findUniqueOrThrow({
      where: { id: data.eventId },
      select: {
        status: true,
        deletedAt: true,
        isTest: true,
        org: { select: { status: true } },
      },
    });
    const ticket = candidate
      ? await tx.ticket.findFirst({
          where: { id: id!, eventId: data.eventId },
          include: { order: { select: { status: true } } },
        })
      : null;
    let result: "VALID" | "ALREADY_USED" | "INVALID" = "INVALID";
    let reason = !authentic
      ? "This QR is not a valid ticket for this event."
      : "No ticket for this event was found. Check the guest’s event and ticket code.";
    if (
      event.status !== "PUBLISHED" ||
      event.deletedAt ||
      event.isTest ||
      event.org.status !== "ACTIVE"
    ) {
      reason =
        "Entry is closed for this event. Ask the event manager for help.";
    } else if (ticket && ticket.order.status !== "PAID") {
      reason =
        "This booking is not confirmed or has been cancelled/refunded. Do not admit this ticket.";
    } else if (ticket) {
      const updated = await tx.ticket.updateMany({
        where: { id: ticket.id, eventId: data.eventId, status: "VALID" },
        data: {
          status: "USED",
          checkedInAt: new Date(),
          checkedInById: userId,
        },
      });
      if (updated.count) {
        result = "VALID";
        reason = "Ticket confirmed. Admit one guest.";
      } else if (
        ticket.status === "USED" ||
        (
          await tx.ticket.findUnique({
            where: { id: ticket.id },
            select: { status: true },
          })
        )?.status === "USED"
      ) {
        result = "ALREADY_USED";
        reason =
          "This ticket has already admitted a guest. Do not admit it again.";
      } else
        reason =
          "This ticket has been cancelled or invalidated. Do not admit it.";
    }
    await tx.auditLog.create({
      data: {
        orgId: access.orgId,
        actorId: userId,
        action: `checkin.${result.toLowerCase()}`,
        entityType: "Ticket",
        entityId: ticket?.id || data.eventId,
        meta: { eventId: data.eventId, result },
      },
    });
    const detail =
      result !== "INVALID" && ticket
        ? await tx.ticket.findUnique({
            where: { id: ticket.id },
            select: {
              id: true,
              holderName: true,
              code: true,
              checkedInAt: true,
              checkedInBy: { select: { name: true } },
              ticketType: { select: { name: true } },
            },
          })
        : null;
    return { result, reason, ticket: detail };
  });
}
