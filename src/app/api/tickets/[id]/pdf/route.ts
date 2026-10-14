import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { storage } from "@/server/providers/storage/s3";
import { queueTicketDelivery } from "@/server/tickets/delivery";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response("Not found", { status: 404 });
  const ticket = await db.ticket.findFirst({
    where: { id: id.data, order: { buyerId: user.id, status: "PAID" } },
  });
  if (!ticket) return new Response("Not found", { status: 404 });
  if (!ticket.pdfKey) {
    await queueTicketDelivery(ticket.orderId);
    return Response.json(
      {
        message:
          ticket.pdfError || "Preparing your PDF. Please try again shortly.",
      },
      {
        status: 202,
        headers: { "Retry-After": "3", "Cache-Control": "no-store" },
      },
    );
  }
  try {
    const pdf = await storage.read(ticket.pdfKey, 10 * 1024 * 1024);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="raunak-${ticket.code}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("PDF temporarily unavailable. Please try again.", {
      status: 503,
    });
  }
}
