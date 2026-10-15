import { renderTicketCard } from "./card-renderer";
export { renderTicketCard } from "./card-renderer";
import { db } from "@/server/db/client";
import { storage } from "@/server/providers/storage/s3";
import { variantUrl } from "@/lib/images";
import { ticketUrl } from "./qr";

export async function eventPoster(eventId: string) {
  const image = await db.eventImage.findFirst({
    where: {
      eventId,
      kind: { in: ["POSTER", "COVER"] },
      processingError: null,
    },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
  });
  if (!image?.variants) return undefined;
  const url = variantUrl(image.variants, "card"),
    prefix = `${process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "")}/`;
  if (!url?.startsWith(prefix)) return undefined;
  const key = decodeURIComponent(url.slice(prefix.length));
  if (!key.startsWith(`orgs/`) && !key.startsWith(`events/`)) return undefined;
  try {
    return await storage.read(key, 5 * 1024 * 1024);
  } catch {
    return undefined;
  }
}
export async function ticketCard(ticketId: string) {
  const ticket = await db.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: {
      event: { include: { org: true } },
      ticketType: true,
      order: true,
    },
  });
  if (
    ticket.order.status !== "PAID" ||
    ticket.status !== "VALID" ||
    ticket.event.status === "CANCELLED" ||
    ticket.event.deletedAt
  )
    throw new Error("This ticket is no longer valid for entry.");
  const event = ticket.event;
  return renderTicketCard({
    title: event.title,
    date:
      new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: event.timezone,
      }).format(event.startsAt) +
      (event.timezone === "Asia/Kolkata" ? " IST" : ` (${event.timezone})`),
    venue: [
      event.venueName ||
        (event.mode === "ONLINE"
          ? "Online event"
          : event.address || "Venue to be announced"),
      event.venueName && event.address !== event.venueName
        ? event.address
        : null,
      event.city,
    ]
      .filter(Boolean)
      .join(", "),
    holder: ticket.holderName,
    organizer: event.org.name,
    type: ticket.ticketType.name,
    code: ticket.code,
    url: ticketUrl(ticket.id, event.id),
    poster: await eventPoster(event.id),
  });
}
