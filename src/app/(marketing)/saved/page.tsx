import Link from "next/link";
import { EventCard } from "@/components/public/event-card";
import { currentUser } from "@/server/auth/session";
import { publicListing } from "@/server/public/events";
import { db } from "@/server/db/client";
import { PageHeader } from "@/components/ui";
export const metadata = {
  title: "Saved events | Raunak",
  robots: { index: false },
};
export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await currentUser();
  if (!user)
    return (
      <>
        <main className="market-page">
          <PageHeader title="Saved events" description="Sign in to see your saved events across devices." />
          <Link href="/login?next=/saved" className="m-button">
            Sign in →
          </Link>
        </main>
      </>
    );
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt((await searchParams).page || "1") || 1),
  );
  const where = {
    userId: user.id,
    event: { ...publicListing, startsAt: { gt: new Date() } },
  };
  const [saved, total] = await Promise.all([
    db.savedEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 12,
      skip: (page - 1) * 12,
      include: {
        event: {
          include: {
            org: { select: { name: true, slug: true, logoKey: true } },
            images: { where: { kind: { in: ["POSTER", "COVER"] } } },
            ticketTypes: {
              where: { isHidden: false },
              select: { pricePaise: true },
            },
          },
        },
      },
    }),
    db.savedEvent.count({ where }),
  ]);
  return (
    <>
      <main className="market-page saved-page">
        <PageHeader title="Saved events" description="Your saved upcoming plans. Unavailable or private events are hidden." actions={<Link href="/discover">Discover more →</Link>} />
        {saved.length ? (
          <ul className="market-grid calm-saved-grid">
            {saved.map((v) => (
              <EventCard key={v.eventId} event={v.event} saved variant="saved" />
            ))}
          </ul>
        ) : (
          <section className="market-empty">
            <p>Tap the heart on any event to keep it here.</p>
            <Link href="/discover" className="m-button">
              Discover events →
            </Link>
          </section>
        )}
        <nav className="ops-pagination">
          {page > 1 && <Link href={`?page=${page - 1}`}>← Previous</Link>}
          {page * 12 < total && <Link href={`?page=${page + 1}`}>Next →</Link>}
        </nav>
      </main>
    </>
  );
}
