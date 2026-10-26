import Link from "next/link";
import QRCode from "qrcode";
import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { EventImage } from "@/components/public/event-image";
import { PdfDownload } from "@/components/public/pdf-download";
import { ResendTickets } from "@/components/public/resend-tickets";
import { TicketQrDisplay } from "@/components/public/ticket-qr-display";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { ticketUrl } from "@/server/tickets/qr";
import { RouteFooter } from "@/components/marketing/footer";
export const metadata = {
  title: "Your entry ticket | Raunak",
  robots: { index: false, follow: false },
};
export default async function TicketDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/my-tickets/${id}`)}`);
  const ticket = await db.ticket.findFirst({
    where: { id, order: { buyerId: user.id } },
    include: {
      event: {
        include: {
          images: { where: { kind: { in: ["POSTER", "COVER"] } }, take: 2 },
          org: {
            select: {
              name: true,
              slug: true,
              supportEmail: true,
              supportPhone: true,
            },
          },
        },
      },
      ticketType: true,
      order: { include: { tickets: { select: { id: true, code: true } } } },
    },
  });
  if (!ticket) notFound();
  const event = ticket.event;
  const active =
    ticket.order.status === "PAID" &&
    ticket.status === "VALID" &&
    event.status === "PUBLISHED" &&
    !event.deletedAt &&
    event.endsAt > new Date();
  const qr = active
    ? await QRCode.toDataURL(ticketUrl(ticket.id, event.id), {
        width: 480,
        margin: 4,
        errorCorrectionLevel: "M",
      })
    : null;
  const directions =
    event.mode !== "ONLINE" && (event.address || event.venueName || event.city)
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.lat !== null && event.lng !== null ? `${event.lat},${event.lng}` : [event.venueName, event.address, event.city].filter(Boolean).join(", "))}`
      : null;
  return (
    <>
      <main className="market-page">
        <Link href="/my-tickets" className="r-back-link">
          ← My tickets
        </Link>
        <div className="ticket-detail">
          <section>
            <EventImage
              variants={
                event.images.find((v) => v.kind === "COVER")?.variants ||
                event.images[0]?.variants
              }
              alt={event.images[0]?.alt || event.title}
              size="hero"
              className="ticket-detail-cover"
            />
            <h1>{event.title}</h1>
            <p>
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "full",
                timeStyle: "short",
                timeZone: event.timezone,
              }).format(event.startsAt)}{" "}
              · {event.timezone}
            </p>
            <p>
              {event.mode === "ONLINE"
                ? "Online event"
                : [event.venueName, event.address, event.city]
                    .filter(Boolean)
                    .join(", ") || "Venue to be announced"}
            </p>
            <p>Hosted by {event.org.name}</p>
            <dl className="ticket-facts">
              <div>
                <dt>Ticket</dt>
                <dd>{ticket.ticketType.name}</dd>
              </div>
              <div>
                <dt>Guest</dt>
                <dd>{ticket.holderName}</dd>
              </div>
              <div>
                <dt>Booking</dt>
                <dd>{ticket.orderId}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{ticket.order.status}</dd>
              </div>
            </dl>
            <div className="wallet-actions">
              <Link
                href={`/orders/${ticket.orderId}`}
                className="r-quiet-button"
              >
                Payment & refund status
              </Link>
              <Link href={`/e/${event.slug}`} className="r-quiet-button">
                Event details ↗
              </Link>
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="r-quiet-button"
                >
                  Directions ↗
                </a>
              )}
              <a
                href={`/api/events/${event.id}/calendar`}
                className="r-quiet-button"
              >
                Add to calendar ↓
              </a>
              {ticket.order.status === "PAID" &&
                (ticket.status === "VALID" || ticket.status === "USED") &&
                event.status !== "CANCELLED" &&
                !event.deletedAt && <PdfDownload ticketId={ticket.id} />}
            </div>
            {ticket.order.status === "PAID" &&
              (ticket.status === "VALID" || ticket.status === "USED") &&
              event.status !== "CANCELLED" &&
              !event.deletedAt && <ResendTickets orderId={ticket.orderId} />}
            <p className="ops-note">
              Support:{" "}
              {event.org.supportEmail ||
                event.org.supportPhone ||
                "Contact Raunak at /contact"}
            </p>
            <Link href="/contact">Contact support ↗</Link>
          </section>
          <aside className="wallet-qr">
            <p className="m-eyebrow">
              {active ? "YOUR WAY IN" : "ADMISSION STATUS"}
            </p>
            <h2>
              {active
                ? "Ready for entry"
                : ticket.status === "USED"
                  ? "Already checked in"
                  : event.status === "CANCELLED"
                    ? "Event cancelled"
                    : event.endsAt <= new Date()
                      ? "Past ticket"
                      : "Ticket inactive"}
            </h2>
            {qr ? (
              <>
                <TicketQrDisplay qr={qr} code={ticket.code} title={event.title} />
                <p>
                  Show this QR to entry staff. Each ticket admits one guest.
                </p>
              </>
            ) : (
              <>
                <strong className="m-mono">{ticket.code}</strong>
                <p>
                  This ticket cannot be used for a new admission. Check your
                  booking for its current status.
                </p>
              </>
            )}
            <small>
              Keep your entry QR private. Share the event link when inviting
              friends.
            </small>
            {ticket.order.tickets.length > 1 && (
              <nav aria-label="Tickets in this booking">
                <h3>Other admission tickets</h3>
                {ticket.order.tickets
                  .filter((v) => v.id !== id)
                  .map((v) => (
                    <Link href={`/my-tickets/${v.id}`} key={v.id}>
                      {v.code} →
                    </Link>
                  ))}
              </nav>
            )}
          </aside>
        </div>
      </main>
      <RouteFooter pathname="/my-tickets/[id]" />
    </>
  );
}
