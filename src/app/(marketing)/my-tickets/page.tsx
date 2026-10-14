import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { APP_NAME } from "@/lib/constants";
export default async function MyTickets() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/my-tickets");
  if (!user.onboardingCompletedAt) redirect("/onboarding?next=/my-tickets");
  const tickets = await db.ticket.findMany({
    where: { order: { buyerId: user.id } },
    include: { event: true, ticketType: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <main className="m-legal m-container">
      <Link href="/" className="m-logo">
        {APP_NAME}
      </Link>
      <div className="m-legal-content">
        <p className="m-eyebrow">YOUR PLANS, ALL IN ONE PLACE</p>
        <h1>
          My <em className="m-serif">tickets.</em>
        </h1>
        {tickets.length ? (
          <div className="m-wallet">
            {tickets.map((ticket) => (
              <article key={ticket.id}>
                <p className="m-mono">{ticket.status}</p>
                <h2>{ticket.event.title}</h2>
                <p>
                  {ticket.ticketType.name} · {ticket.holderName}
                </p>
                <p>
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "full",
                    timeStyle: "short",
                    timeZone: ticket.event.timezone,
                  }).format(ticket.event.startsAt)}
                </p>
                <strong className="m-mono">{ticket.code}</strong>
              </article>
            ))}
          </div>
        ) : (
          <div className="m-wallet-empty">
            <h2>A little room for your next plan.</h2>
            <p>Your booked tickets will appear here.</p>
            <Link href="/discover" className="m-button">
              Browse events ↗
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
