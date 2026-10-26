import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { APP_NAME } from "@/lib/constants";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/server/db/client";
import {
  tokenTicketId,
  verifyTicketToken,
  ticketUrl,
} from "@/server/tickets/qr";
import { RouteFooter } from "@/components/marketing/footer";
export const metadata = {
  title: "Your ticket | Raunak",
  robots: { index: false, follow: false },
};
export default async function TicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const id = tokenTicketId(token);
  if (!id) notFound();
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      event: true,
      ticketType: true,
      order: { select: { status: true } },
    },
  });
  if (!ticket || !verifyTicketToken(token, ticket.eventId)) notFound();
  const active =
    ticket.order.status === "PAID" &&
    ticket.event.status !== "CANCELLED" &&
    !ticket.event.deletedAt;
  const qr = await QRCode.toDataURL(ticketUrl(ticket.id, ticket.eventId), {
    width: 360,
    margin: 4,
  });
  return (
    <>
    <main className="m-legal m-container">
      <Link href="/" className="m-logo">
        <BrandMark className="m-logo-mark" />
        {APP_NAME}
      </Link>
      <div className="m-legal-content">
        <p className="m-eyebrow">YOUR WAY IN</p>
        <h1>{ticket.event.title}</h1>
        <article className="r-real-ticket">
          <p className="m-mono">
            {active
              ? ticket.status === "USED"
                ? "ALREADY CHECKED IN"
                : ticket.status
              : "INACTIVE"}
          </p>
          <h2>{ticket.ticketType.name}</h2>
          <p>{ticket.holderName}</p>
          <p>
            {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: ticket.event.timezone,
            }).format(ticket.event.startsAt)}
          </p>
          <p>
            {ticket.event.venueName || "Online event"}
            {ticket.event.city ? ` · ${ticket.event.city}` : ""}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {active && ticket.status === "VALID" && <img
            src={qr}
            alt="Your signed entry QR code"
            width={280}
            height={280}
          />}
          <strong className="m-mono">{ticket.code}</strong>
          <p>
            {active && ticket.status === "VALID" ? "Present this QR to entry staff. Opening this page does not check you in." : ticket.status === "USED" ? "This ticket has already been checked in. It cannot be used again." : "This ticket is inactive and cannot be used for entry."}
          </p>
          <Link href="/my-tickets" className="m-button">
            My ticket wallet ↗
          </Link>
        </article>
      </div>
    </main>
    <RouteFooter pathname="/t/[token]" />
    </>
  );
}
