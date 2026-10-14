import { requireUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { attendeeFilters, csvCell } from "@/lib/attendees";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const user = await requireUser();
    const { eventId } = await params;
    await requireEventAccessForUser(user.id, eventId, [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "FINANCE",
    ]);
    const query = new URL(request.url).searchParams;
    const where = attendeeFilters(
      eventId,
      query.get("q") || "",
      query.get("status") || "",
    );
    const encode = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encode.encode(
              "\uFEFFName,Email,Phone,Ticket,Code,Status,Checked in (UTC)\r\n",
            ),
          );
          let cursor: string | undefined;
          while (!request.signal.aborted) {
            const rows = await db.ticket.findMany({
              where,
              orderBy: { id: "asc" },
              take: 1000,
              ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
              include: { ticketType: { select: { name: true } } },
            });
            if (!rows.length) break;
            controller.enqueue(
              encode.encode(
                rows
                  .map((row) =>
                    [
                      row.holderName,
                      row.holderEmail,
                      row.holderPhone,
                      row.ticketType.name,
                      row.code,
                      row.status,
                      row.checkedInAt?.toISOString(),
                    ]
                      .map(csvCell)
                      .join(","),
                  )
                  .join("\r\n") + "\r\n",
              ),
            );
            cursor = rows.at(-1)!.id;
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="raunak-attendees-${eventId}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "Export unavailable. Check your event access and filters." },
      { status: 403 },
    );
  }
}
