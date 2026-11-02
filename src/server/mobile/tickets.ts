import { variantUrl } from "@/lib/images";
import { ticketUrl } from "@/server/tickets/qr";

type TicketView = {
  id: string;
  code: string;
  orderId: string;
  holderName: string;
  status: string;
  ticketType: { name: string };
  order: { status: string; _count: { tickets: number } };
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    venueName: string | null;
    address: string | null;
    city: string | null;
    mode: string;
    status: string;
    deletedAt: Date | null;
    lat: unknown;
    lng: unknown;
    org: { name: string };
    images: { kind: string; variants: unknown }[];
  };
};
export function mobileEvent(event: TicketView["event"]) {
  const base = process.env.APP_URL || "http://localhost:3000";
  const poster =
    event.images.find((i) => i.kind === "POSTER") || event.images[0];
  const image =
    variantUrl(poster?.variants, "card", "webp") ||
    variantUrl(poster?.variants, "card");
  const location =
    event.lat != null && event.lng != null
      ? `${event.lat},${event.lng}`
      : [event.venueName, event.address, event.city].filter(Boolean).join(", ");
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    dateLabel: new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: event.timezone,
    }).format(event.startsAt),
    venueLabel:
      event.mode === "ONLINE"
        ? "Online event"
        : [event.venueName, event.city].filter(Boolean).join(" · "),
    imageUrl: image ? new URL(image, base).href : null,
    organizerName: event.org.name,
    publicUrl: new URL(`/e/${event.slug}`, base).href,
    directionsUrl:
      event.mode !== "ONLINE" && location
        ? `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: location })}`
        : null,
    calendarUrl: new URL(`/api/events/${event.id}/calendar`, base).href,
  };
}
export function mobileTicket(
  ticket: TicketView,
  includeQr = false,
  now = new Date(),
) {
  const event = ticket.event;
  const cancelled =
    event.status === "CANCELLED" ||
    !!event.deletedAt ||
    ticket.status === "CANCELLED";
  const active =
    ticket.order.status === "PAID" &&
    ticket.status === "VALID" &&
    event.status === "PUBLISHED" &&
    !event.deletedAt &&
    event.endsAt > now;
  const admissionLabel =
    ticket.status === "REFUNDED" || ticket.order.status === "REFUNDED"
      ? "Refunded"
      : cancelled
        ? "Cancelled"
        : ticket.status === "USED"
          ? "Checked in"
          : event.endsAt <= now
            ? "Past event"
            : active
              ? "Ready for entry"
              : "Ticket inactive";
  const pdfAvailable =
    ticket.order.status === "PAID" &&
    ["VALID", "USED"].includes(ticket.status) &&
    !cancelled;
  return {
    id: ticket.id,
    code: ticket.code,
    orderId: ticket.orderId,
    ticketType: ticket.ticketType.name,
    holderName: ticket.holderName,
    status: ticket.status,
    orderStatus: ticket.order.status,
    admissionLabel,
    active,
    pdfAvailable,
    quantity: ticket.order._count.tickets,
    event: mobileEvent(event),
    ...(includeQr
      ? { qrPayload: active ? ticketUrl(ticket.id, event.id) : null }
      : {}),
  };
}
export const ticketInclude = {
  event: {
    include: {
      images: {
        where: { kind: { in: ["POSTER", "COVER"] as ("POSTER" | "COVER")[] } },
        take: 2,
      },
      org: { select: { name: true } },
    },
  },
  ticketType: { select: { name: true } },
  order: { select: { status: true, _count: { select: { tickets: true } } } },
};
