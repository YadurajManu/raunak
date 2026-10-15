import { db } from "@/server/db/client";
import { requireUser } from "@/server/auth/session";
import { messageAccess } from "./access";
import { renderTicketCard, eventPoster } from "@/server/tickets/card";
import { producerConnection } from "../../../worker/queues";
export async function messagePreviewResponse(
  eventId: string | null,
  orgId?: string,
) {
  try {
    const user = await requireUser(),
      scope = await messageAccess(user.id, eventId, orgId);
    const count = Number(
      await producerConnection.eval(
        `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n`,
        1,
        `wa:preview:${scope.orgId}:${user.id}`,
      ),
    );
    if (count > 10) return new Response(null, { status: 429 });
    const event = await db.event.findFirst({
      where: {
        orgId: scope.orgId,
        ...(eventId ? { id: eventId } : {}),
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      include: { org: true },
    });
    if (!event) return new Response(null, { status: 404 });
    const image = await renderTicketCard({
      title: event.title,
      date: event.startsAt.toLocaleString("en-IN", {
        timeZone: event.timezone,
      }),
      venue: [event.venueName || "Venue", event.city]
        .filter(Boolean)
        .join(", "),
      holder: user.name || "Organizer",
      organizer: event.org.name,
      type: "Sample ticket",
      code: "SAMPLE",
      url: `${process.env.APP_URL}/e/${event.slug}`,
      sample: true,
      poster: await eventPoster(event.id),
    });
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 403 });
  }
}
