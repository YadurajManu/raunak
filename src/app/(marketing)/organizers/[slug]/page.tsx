import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { currentUser } from "@/server/auth/session";
import { discoverPage, publicListing } from "@/server/public/events";
import { EventCard } from "@/components/public/event-card";
import { Star } from "lucide-react";
export default async function OrganizerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await db.organization.findFirst({
    where: { slug, status: "ACTIVE", events: { some: publicListing } },
    select: { id: true, name: true, slug: true, supportEmail: true, supportPhone: true },
  });
  if (!org) notFound();
  const [result, reviewSummary] = await Promise.all([
    discoverPage({ organizer: slug }),
    db.eventReview.aggregate({
      where: {
        event: {
          orgId: org.id,
          status: { in: ["PUBLISHED", "ENDED"] },
          visibility: "PUBLIC",
          deletedAt: null,
          isTest: false,
          org: { status: "ACTIVE" },
        },
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);
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
            {reviewSummary._count._all > 0 && reviewSummary._avg.rating !== null && (
              <p className="mt-3 inline-flex items-center gap-2 text-sm">
                <Star size={15} fill="currentColor" className="text-[var(--accent)]" aria-hidden="true" />
                <strong>{reviewSummary._avg.rating.toFixed(1)}</strong>
                <span>from {reviewSummary._count._all} verified attendee {reviewSummary._count._all === 1 ? "review" : "reviews"}</span>
              </p>
            )}
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
