import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { mobileTicket, ticketInclude } from "@/server/mobile/tickets";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    if (!user)
      return Response.json(
        { error: "Please sign in to view this ticket." },
        { status: 401, headers },
      );
    const parsed = z.uuid().safeParse((await params).id);
    if (!parsed.success)
      return Response.json(
        { error: "Ticket not found." },
        { status: 404, headers },
      );
    const ticket = await db.ticket.findFirst({
      where: { id: parsed.data, order: { buyerId: user.id } },
      include: ticketInclude,
    });
    if (!ticket)
      return Response.json(
        { error: "Ticket not found." },
        { status: 404, headers },
      );
    const siblings = await db.ticket.findMany({
      where: { orderId: ticket.orderId, order: { buyerId: user.id } },
      select: { id: true, code: true },
      orderBy: { createdAt: "asc" },
    });
    return Response.json(
      { ...mobileTicket(ticket, true), siblings },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Your ticket could not be loaded. Please retry." },
      { status: 503, headers },
    );
  }
}
