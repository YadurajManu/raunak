import Link from "next/link";
import { ResendTickets } from "@/components/public/resend-tickets";
import { BookingRefresh } from "@/components/public/booking-refresh";
import { PdfDownload } from "@/components/public/pdf-download";
import { EventImage } from "@/components/public/event-image";
import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { reconcileOrder } from "@/server/checkout/service";
import { ticketToken } from "@/server/tickets/qr";
import { formatInr } from "@/lib/money";
import { eventCalendarUrl } from "@/lib/event-calendar";
import { whatsappEventUrl } from "@/lib/event-share";

export const metadata = {
  title: "Your booking | Raunak",
  robots: { index: false, follow: false },
};
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);
  const load = () =>
    db.order.findFirst({
      where: { id, buyerId: user.id },
      include: {
        event: {
          include: {
            images: { where: { kind: "POSTER" }, take: 1 },
            org: { select: { supportEmail: true, supportPhone: true } },
          },
        },
        items: { include: { ticketType: true } },
        tickets: true,
      payments: { select: { refunds: { select: { id: true, amountPaise: true, status: true } } } },
        notificationLogs: {
          where: {
            channel: "EMAIL",
            trigger: { in: ["ORDER_CONFIRMED", "TICKET_ISSUED"] },
          },
          select: { status: true },
        },
      },
    });
  let order = await load();
  if (!order) notFound();
  let reconciliationDelayed = false;
  if (order.status === "PENDING" && order.cashfreeOrderId) {
    try {
      await reconcileOrder(id);
      order = (await load())!;
    } catch {
      reconciliationDelayed = true;
    }
  }
  const paid = order.status === "PAID";
  const pending = order.status === "PENDING";
  const event = order.event;
  const refunds = order.payments.flatMap(payment => payment.refunds);
  const url = `${process.env.APP_URL}/e/${event.slug}`;
  const cancelled = event.status === "CANCELLED" || !!event.deletedAt;
  const date = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: event.timezone,
  }).format(event.startsAt);
  const directions =
    event.mode !== "ONLINE" &&
    (event.address || event.venueName || event.city || event.lat !== null)
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.lat !== null && event.lng !== null ? `${event.lat},${event.lng}` : [event.venueName, event.address, event.city].filter(Boolean).join(", "))}`
      : null;
  const emailFailed = order.notificationLogs.some(
    (log) => log.status === "FAILED",
  );
  const emailSent =
    order.notificationLogs.length > 0 &&
    order.notificationLogs.every((log) =>
      ["SENT", "DELIVERED", "READ"].includes(log.status),
    );
  return (
    <main className="booking-page">
      <Link href="/my-tickets" className="r-back-link">
        ← My tickets
      </Link>
      <header className="booking-heading">
        <span className="booking-seal" aria-hidden="true">
          {paid ? "✓" : pending ? "◷" : "!"}
        </span>
        <p className="m-eyebrow">
          {paid
            ? "YOUR PLAN IS CONFIRMED"
            : pending
              ? "ONE MORE MOMENT"
              : "BOOKING UPDATE"}
        </p>
        <h1>
          {paid
            ? "You're going."
            : pending
              ? "Confirming your payment."
              : order.status === "REFUNDED"
                ? "Payment refunded."
                : "Booking not completed."}
        </h1>
        <p>
          {paid
            ? "Your next good memory starts here. Keep your tickets handy."
            : pending
              ? "Please wait for confirmation before trying another payment."
              : "No active tickets are available for this booking. Check the status below before booking again."}
        </p>
      </header>
      {cancelled && (
        <p role="alert" className="booking-notice">
          This event is no longer available. Contact the organizer about any
          refund.
        </p>
      )}
      {refunds.map(refund => <p key={refund.id} className="booking-notice">Refund {formatInr(refund.amountPaise)} · {refund.status === "SUCCESS" ? "Confirmed by Cashfree. Your bank may take additional time to credit it." : refund.status === "FAILED" ? "Needs organizer review. Contact the organizer with your order reference." : "Processing with Cashfree. Check status again shortly."}</p>)}
      <div className="booking-grid">
        <section>
          <article className="booking-event">
            <EventImage
              variants={event.images[0]?.variants}
              alt={event.images[0]?.alt || event.title}
              size="card"
              className="booking-poster"
            />
            <div>
              <h2>{event.title}</h2>
              <p>{date}</p>
              <small>{event.timezone}</small>
              <p>
                {event.mode === "ONLINE"
                  ? "Online event"
                  : [event.venueName, event.address, event.city]
                      .filter(Boolean)
                      .join(", ") || "Venue to be announced"}
              </p>
              <div className="booking-links">
                {paid && !cancelled && (
                  <>
                    <a
                      href={eventCalendarUrl(event, url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Add to calendar ↗
                    </a>
                    {directions && (
                      <a
                        href={directions}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Get directions ↗
                      </a>
                    )}
                    <a
                      href={whatsappEventUrl(event.title, url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Invite friends ↗
                    </a>
                  </>
                )}
                <Link href={`/e/${event.slug}`}>Event details ↗</Link>
              </div>
            </div>
          </article>
          {paid && !cancelled && (
            <section className="booking-tickets">
              <h2>
                Your tickets <small>{order.tickets.length}</small>
              </h2>
              {order.tickets.length ? (
                order.tickets.map((ticket) => (
                  <article className="booking-pass" key={ticket.id}>
                    <div>
                      <span className="m-mono">{ticket.status}</span>
                      <h3>
                        {order.items.find(
                          (item) => item.ticketTypeId === ticket.ticketTypeId,
                        )?.ticketType.name || "Entry ticket"}
                      </h3>
                      <p>{ticket.holderName}</p>
                      <small className="m-mono">{ticket.code}</small>
                    </div>
                    <div className="booking-pass-actions">
                      <Link
                        className="m-button m-button-small"
                        href={`/t/${ticketToken(ticket.id, ticket.eventId)}`}
                      >
                        Show entry QR ↗
                      </Link>
                      <PdfDownload ticketId={ticket.id} />
                    </div>
                  </article>
                ))
              ) : (
                <p>
                  Your tickets are being prepared. Use Check status below in a
                  moment.
                </p>
              )}
              <p className="booking-private">
                Keep entry QR codes private. Invite friends using the public
                event link.
              </p>
            </section>
          )}
          {(pending || reconciliationDelayed) && (
            <p className="booking-notice">
              {reconciliationDelayed
                ? "The payment provider is taking longer to respond. Your booking is safe; check again shortly."
                : "Payment confirmation is pending. No ticket is valid until the payment is confirmed."}
            </p>
          )}
          <BookingRefresh pending={pending} />
        </section>
        <aside className="booking-summary">
          <h2>Booking summary</h2>
          <span className="tk-status">{order.status}</span>
          {order.items.map((item) => (
            <div className="booking-line" key={item.ticketTypeId}>
              <span>
                {item.quantity} × {item.ticketType.name}
              </span>
              <strong>{formatInr(item.quantity * item.unitPricePaise)}</strong>
            </div>
          ))}
          <div className="booking-line booking-total">
            <span>{paid ? "Total paid" : "Order total"}</span>
            <strong>{formatInr(order.totalPaise)}</strong>
          </div>
          <p className="booking-reference">Order {order.id}</p>
          {paid && (
            <section className="booking-delivery">
              <h3>Receipt & tickets</h3>
              <p>
                {emailFailed
                  ? "Email delivery needs another try. Resend below, or download your tickets."
                  : emailSent
                    ? "Confirmation and tickets sent to your inbox."
                    : "Your receipt and QR tickets are being prepared for email."}
              </p>
              <small>{order.buyerEmail}</small>
              {!cancelled && <ResendTickets orderId={order.id} />}
            </section>
          )}
          {!paid && !pending && (
            <Link
              className="m-button m-button-small"
              href={`/e/${event.slug}#tickets`}
            >
              Choose tickets again ↗
            </Link>
          )}
          <p className="booking-help">
            Need help?{" "}
            {event.org.supportEmail ||
              event.org.supportPhone ||
              "Contact the organizer through the event page."}
          </p>
        </aside>
      </div>
    </main>
  );
}
