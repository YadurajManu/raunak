import Link from "next/link";
import { PublicHeader } from "@/components/public/public-header";
import { EventCard } from "@/components/public/event-card";
import { currentUser } from "@/server/auth/session";
import { publicListing } from "@/server/public/events";
import { db } from "@/server/db/client";
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
        <PublicHeader />
        <main className="market-page">
          <h1>Keep good plans close.</h1>
          <p>Sign in to see your saved events across devices.</p>
          <Link href="/login?next=/saved" className="m-button">
            Sign in ↗
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
            org: { select: { name: true, slug: true } },
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
      <PublicHeader />
      <main className="market-page">
        <header className="wallet-heading">
          <div>
            <p className="m-eyebrow">KEEP A LITTLE ROOM</p>
            <h1>Saved events</h1>
            <p>
              Your saved upcoming plans. Unavailable or private events are
              hidden.
            </p>
          </div>
          <Link href="/discover">Discover more ↗</Link>
        </header>
        {saved.length ? (
          <ul className="market-grid">
            {saved.map((v) => (
              <EventCard key={v.eventId} event={v.event} saved />
            ))}
          </ul>
        ) : (
          <section className="market-empty">
            <h2>Your next plan is waiting.</h2>
            <p>Tap the heart on an event to save it here.</p>
            <Link href="/discover" className="m-button">
              Explore events ↗
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
