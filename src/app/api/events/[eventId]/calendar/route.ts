import { z } from "zod";
import { db } from "@/server/db/client";
import { currentUser } from "@/server/auth/session";
import { calendarFile } from "@/lib/calendar-file";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const eventId = (await params).eventId;
  if (!z.uuid().safeParse(eventId).success)
    return new Response("Not found", { status: 404 });
  const user = await currentUser();
  const event = await db.event.findFirst({
    where: {
      id: eventId,
      deletedAt: null,
      isTest: false,
      OR: [
        { status: "PUBLISHED", org: { status: "ACTIVE" } },
        ...(user ? [{ orders: { some: { buyerId: user.id } } }] : []),
      ],
    },
  });
  if (!event) return new Response("Not found", { status: 404 });
  return new Response(
    calendarFile(event, `${process.env.APP_URL}/e/${event.slug}`),
    {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=raunak-event.ics",
        "Cache-Control": "private, no-store",
      },
    },
  );
}
