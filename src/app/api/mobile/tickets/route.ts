import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { walletTabs, walletWhere } from "@/lib/wallet";
import {
  mobileEvent,
  mobileTicket,
  ticketInclude,
} from "@/server/mobile/tickets";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user)
      return Response.json(
        { error: "Please sign in to view your tickets." },
        { status: 401, headers },
      );
    const filter = z
      .object({
        tab: z.enum(walletTabs).default("upcoming"),
        q: z.string().trim().max(100).default(""),
        page: z.coerce.number().int().min(1).max(100000).default(1),
        orderId: z.uuid().optional(),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    if (
      filter.orderId &&
      !(await db.order.findFirst({
        where: { id: filter.orderId, buyerId: user.id },
        select: { id: true },
      }))
    )
      return Response.json(
        { error: "Booking not found." },
        { status: 404, headers },
      );
    const where = filter.orderId
      ? { orderId: filter.orderId, order: { buyerId: user.id } }
      : walletWhere(user.id, filter.tab, filter.q);
    const [tickets, total, pending] = await Promise.all([
      db.ticket.findMany({
        where,
        include: ticketInclude,
        take: 12,
        skip: (filter.page - 1) * 12,
        orderBy: [
          { event: { startsAt: filter.tab === "past" ? "desc" : "asc" } },
          { id: "asc" },
        ],
      }),
      db.ticket.count({ where }),
      db.order.findMany({
        where: {
          buyerId: user.id,
          status: "PENDING",
          ...(filter.orderId ? { id: filter.orderId } : {}),
        },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { event: ticketInclude.event },
      }),
    ]);
    return Response.json(
      {
        tickets: tickets.map((t) => mobileTicket(t)),
        total,
        page: filter.page,
        hasMore: filter.page * 12 < total,
        pendingBookings: pending.map((order) => ({
          id: order.id,
          status: order.status,
          totalPaise: order.totalPaise,
          event: mobileEvent(order.event),
        })),
      },
      { headers },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Check your ticket filters."
            : "Tickets could not be loaded. Please retry.",
      },
      { status: error instanceof z.ZodError ? 400 : 503, headers },
    );
  }
}
