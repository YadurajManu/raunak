import Link from "next/link";
import { PublicHeader } from "@/components/public/public-header";
import { EventImage } from "@/components/public/event-image";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { walletWhere, walletTabs } from "@/lib/wallet";
export const metadata = {
  title: "My tickets | Raunak",
  robots: { index: false, follow: false },
};
export default async function MyTickets({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const user = await currentUser();
  if (!user)
    return (
      <>
        <PublicHeader />
        <main className="market-page">
          <h1>Your plans, all in one place.</h1>
          <p>Sign in with the account used to book your tickets.</p>
          <Link href="/login?next=/my-tickets" className="m-button">
            Sign in to your wallet ↗
          </Link>
          <Link href="/my-tickets/recover" className="r-quiet-button">
            Find a booking
          </Link>
        </main>
      </>
    );
  const raw = await searchParams;
  const tab = walletTabs.find((v) => v === raw.tab) || "upcoming";
  const q = (raw.q || "").trim().slice(0, 100);
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(raw.page || "1") || 1),
  );
  const where = walletWhere(user.id, tab, q);
  const [tickets, count, all, counts] = await Promise.all([
    db.ticket.findMany({
      where,
      orderBy:
        raw.sort === "newest"
          ? [{ createdAt: "desc" as const }, { id: "asc" as const }]
          : [
              {
                event: {
                  startsAt:
                    tab === "past" ? ("desc" as const) : ("asc" as const),
                },
              },
              { id: "asc" as const },
            ],
      take: 12,
      skip: (page - 1) * 12,
      include: {
        event: {
          include: {
            images: { where: { kind: "POSTER" }, take: 1 },
            org: { select: { name: true } },
          },
        },
        ticketType: true,
        order: {
          select: { status: true, _count: { select: { tickets: true } } },
        },
      },
    }),
    db.ticket.count({ where }),
    db.ticket.count({ where: { order: { buyerId: user.id } } }),
    Promise.all(
      walletTabs.map((tab) =>
        db.ticket.count({ where: walletWhere(user.id, tab) }),
      ),
    ),
  ]);
  const href = (n: number) =>
    `?tab=${tab}&q=${encodeURIComponent(q)}&sort=${raw.sort === "newest" ? "newest" : "date"}&page=${n}`;
  return (
    <>
      <PublicHeader />
      <main className="market-page wallet-page">
        <header className="wallet-heading">
          <div>
            <p className="m-eyebrow">YOUR PLANS, READY WHEN YOU ARE</p>
            <h1>My tickets</h1>
            <p>Open your ticket, show the QR, make a good memory.</p>
          </div>
          <Link href="/my-tickets/recover" className="r-quiet-button">
            Find a booking
          </Link>
        </header>
        <nav className="wallet-tabs" aria-label="Ticket status">
          {walletTabs.map((v, i) => (
            <Link
              key={v}
              href={`?tab=${v}`}
              aria-current={v === tab ? "page" : undefined}
            >
              {v[0].toUpperCase() + v.slice(1)} <small>{counts[i]}</small>
            </Link>
          ))}
        </nav>
        <form className="ops-filters">
          <input type="hidden" name="tab" value={tab} />
          <label className="sr-only" htmlFor="wallet-search">
            Search your tickets
          </label>
          <input
            id="wallet-search"
            name="q"
            defaultValue={q}
            placeholder="Event, ticket type or code"
            maxLength={100}
          />
          <label className="sr-only" htmlFor="wallet-sort">
            Sort tickets
          </label>
          <select
            id="wallet-sort"
            name="sort"
            defaultValue={raw.sort === "newest" ? "newest" : "date"}
          >
            <option value="date">Event date</option>
            <option value="newest">Recently booked</option>
          </select>
          <button className="r-quiet-button">Search</button>
          {q && <Link href={`?tab=${tab}`}>Clear search</Link>}
        </form>
        {tickets.length ? (
          <div className="wallet-grid">
            {tickets.map((ticket) => (
              <article className="wallet-card" key={ticket.id}>
                <EventImage
                  variants={ticket.event.images[0]?.variants}
                  alt={ticket.event.images[0]?.alt || ticket.event.title}
                  size="card"
                  className="wallet-cover"
                />
                <div>
                  <span className="tk-status">
                    {ticket.event.status === "CANCELLED"
                      ? "Event cancelled"
                      : ticket.order.status !== "PAID"
                        ? ticket.order.status
                        : ticket.status === "USED"
                          ? "Checked in"
                          : ticket.status}
                  </span>
                  <h2>{ticket.event.title}</h2>
                  <p>
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: ticket.event.timezone,
                    }).format(ticket.event.startsAt)}
                  </p>
                  <p>
                    {ticket.event.mode === "ONLINE"
                      ? "Online"
                      : [ticket.event.venueName, ticket.event.city]
                          .filter(Boolean)
                          .join(" · ") || "Venue to be announced"}
                  </p>
                  <small>By {ticket.event.org.name}</small>
                  <p>{ticket.ticketType.name} · 1 admission ticket</p>
                  <small>
                    {ticket.order._count.tickets} ticket(s) in this booking ·{" "}
                    {ticket.code}
                  </small>
                  <small className="wallet-reference">
                    Booking {ticket.orderId}
                  </small>
                  <Link
                    className="m-button m-button-small"
                    href={`/my-tickets/${ticket.id}`}
                  >
                    {tab === "upcoming" && ticket.status === "VALID"
                      ? "Show entry QR ↗"
                      : "View ticket ↗"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="market-empty">
            <h2>
              {q
                ? "No tickets match that search."
                : !all
                  ? "Your next good memory starts here."
                  : `No ${tab} tickets right now.`}
            </h2>
            <p>
              {q
                ? "Try the event name or ticket code, or clear your search."
                : !all
                  ? "Booked tickets appear here when payment is confirmed. Use the same account you booked with."
                  : "Choose another tab to see your other tickets."}
            </p>
            <div className="wallet-actions">
              <Link href="/discover" className="m-button m-button-small">
                Explore events ↗
              </Link>
              <Link href="/my-tickets/recover" className="r-quiet-button">
                Find a booking
              </Link>
            </div>
          </section>
        )}
        <nav className="ops-pagination" aria-label="Ticket pages">
          {page > 1 && <Link href={href(page - 1)}>← Previous</Link>}
          <span>{count} tickets</span>
          {page * 12 < count && <Link href={href(page + 1)}>Next →</Link>}
        </nav>
      </main>
    </>
  );
}
