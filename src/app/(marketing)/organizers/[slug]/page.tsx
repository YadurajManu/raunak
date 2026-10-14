import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/public-header";
import { db } from "@/server/db/client";
import { currentUser } from "@/server/auth/session";
import { discoverPage, publicListing } from "@/server/public/events";
import { EventCard } from "@/components/public/event-card";
export default async function OrganizerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await db.organization.findFirst({
    where: { slug, status: "ACTIVE", events: { some: publicListing } },
    select: { name: true, slug: true, supportEmail: true, supportPhone: true },
  });
  if (!org) notFound();
  const result = await discoverPage({ organizer: slug });
  const user = await currentUser();
  const saved = user
    ? await db.savedEvent.findMany({
        where: {
          userId: user.id,
          eventId: { in: result.events.map((event) => event.id) },
        },
        select: { eventId: true },
      })
    : [];
  return (
    <>
      <PublicHeader />
      <main className="market-page">
        <header className="wallet-heading">
          <div>
            <p className="m-eyebrow">MEET YOUR ORGANIZER</p>
            <h1>{org.name}</h1>
            <p>
              {org.supportEmail ||
                org.supportPhone ||
                "Contact details appear on each event."}
            </p>
          </div>
        </header>
        <h2>Upcoming events</h2>
        {result.events.length ? (
          <ul className="market-grid">
            {result.events.map((event) => (
              <EventCard
                event={event}
                key={event.id}
                saved={saved.some((item) => item.eventId === event.id)}
              />
            ))}
          </ul>
        ) : (
          <p>No upcoming events right now.</p>
        )}
        <Link href={`/discover?organizer=${encodeURIComponent(slug)}`}>
          View all organizer events ↗
        </Link>
      </main>
    </>
  );
}
