import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { AccountShell } from "@/components/onboarding/account-shell";
import { formatInr } from "@/lib/money";
export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompletedAt) redirect("/onboarding");
  const [tickets, orders, events] = await Promise.all([
    db.ticket.findMany({
      where: {
        order: { buyerId: user.id },
        event: { endsAt: { gte: new Date() } },
        status: { in: ["VALID", "USED"] },
      },
      include: { event: true, ticketType: true },
      orderBy: { event: { startsAt: "asc" } },
      take: 6,
    }),
    db.order.findMany({
      where: { buyerId: user.id },
      include: { event: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.event.findMany({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        deletedAt: null,
        startsAt: { gt: new Date() },
        ...(user.city
          ? { city: { equals: user.city, mode: "insensitive" as const } }
          : {}),
      },
      take: 3,
      orderBy: { startsAt: "asc" },
    }),
  ]);
  return (
    <AccountShell
      name={user.name || "Your account"}
      email={user.email}
      avatarUrl={user.avatarKey}
    >
      <p className="m-eyebrow">
        {user.city
          ? `YOUR PLANS IN ${user.city.toUpperCase()}`
          : "GOOD TO HAVE YOU HERE"}
      </p>
      <h1>
        Hey, {user.name?.split(" ")[0]}.<br />
        <em className="m-serif">What’s the plan?</em>
      </h1>
      <p className="r-account-intro">
        Your tickets, your next night out, and a little room for a new idea.
      </p>
      <div className="r-account-section-title">
        <h2>Coming up</h2>
        <Link href="/my-tickets">All tickets ↗</Link>
      </div>
      {tickets.length ? (
        <div className="r-account-cards">
          {tickets.map((ticket) => (
            <article key={ticket.id}>
              <p className="m-mono">
                {ticket.ticketType.name} · {ticket.status}
              </p>
              <h3>{ticket.event.title}</h3>
              <p>
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeZone: ticket.event.timezone,
                }).format(ticket.event.startsAt)}
              </p>
              <b className="m-mono">{ticket.code}</b>
            </article>
          ))}
        </div>
      ) : (
        <div className="r-account-empty">
          <span>🎟</span>
          <h3>Your next good memory starts here.</h3>
          <p>No upcoming tickets yet. Find something worth showing up for.</p>
          <Link href="/discover" className="m-button">
            Find an event ↗
          </Link>
        </div>
      )}
      <div className="r-account-section-title">
        <h2>{user.city ? `Around ${user.city}` : "Worth stepping out for"}</h2>
        <Link
          href={`/discover${user.city ? `?city=${encodeURIComponent(user.city)}` : ""}`}
        >
          Explore ↗
        </Link>
      </div>
      {events.length ? (
        <div className="r-account-cards">
          {events.map((event) => (
            <Link href={`/e/${event.slug}`} key={event.id}>
              <article>
                <p className="m-mono">{event.category || "EVENT"}</p>
                <h3>{event.title}</h3>
                <p>
                  {event.city || "Online"} ·{" "}
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeZone: event.timezone,
                  }).format(event.startsAt)}
                </p>
                <span>See event ↗</span>
              </article>
            </Link>
          ))}
        </div>
      ) : (
        <div className="r-account-simple-empty">
          No upcoming public events here yet.{" "}
          <Link href="/discover">Explore all cities ↗</Link>
        </div>
      )}
      <div className="r-account-section-title">
        <h2>Recent orders</h2>
      </div>
      {orders.length ? (
        <div className="r-order-list">
          {orders.map((order) => (
            <div key={order.id}>
              <span>
                <b>{order.event.title}</b>
                <small>{order.id.slice(0, 8)}</small>
              </span>
              <span>{formatInr(order.totalPaise)}</span>
              <span className="m-mono">{order.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="r-account-simple-empty">
          Your bookings will appear here.
        </p>
      )}
    </AccountShell>
  );
}
