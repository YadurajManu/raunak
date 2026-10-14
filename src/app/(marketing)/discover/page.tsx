import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public/public-header";
import { MarketingFooter } from "@/components/marketing/footer";
import { DiscoverFilters } from "@/components/public/discover-filters";
import { EventCard } from "@/components/public/event-card";
import { discoverPage, publicListing } from "@/server/public/events";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { discoverySchema, discoveryUrl } from "@/lib/discovery";
export const metadata: Metadata = {
  title: "Discover events | Raunak",
  description: "Good people. Great events. Find your next plan on Raunak.",
};
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = discoverySchema.safeParse(
    Object.fromEntries(
      Object.entries(raw)
        .filter(([, v]) => v !== "" && v !== undefined)
        .map(([k, v]) => [
          k,
          Array.isArray(v) ? (k === "category" ? v.join("|") : v[0]) : v,
        ]),
    ),
  );
  if (!parsed.success)
    return (
      <>
        <PublicHeader />
        <main className="market-page">
          <h1>Let’s adjust those filters.</h1>
          <p role="alert">{parsed.error.issues[0].message}</p>
          <Link className="m-button" href="/discover">
            Reset filters
          </Link>
        </main>
      </>
    );
  const [result, locations, user] = await Promise.all([
    discoverPage(parsed.data),
    db.event.findMany({
      where: {
        ...publicListing,
        startsAt: { gt: new Date() },
        city: { not: null },
      },
      distinct: ["city"],
      select: { city: true },
      take: 100,
    }),
    currentUser(),
  ]);
  const saved = user
    ? await db.savedEvent.findMany({
        where: {
          userId: user.id,
          eventId: { in: result.events.map((v) => v.id) },
        },
        select: { eventId: true },
      })
    : [];
  return (
    <>
      <PublicHeader />
      <main className="market-page d-discover">
        <section className="d-hero">
          <div>
            <p className="m-eyebrow">GOOD PEOPLE. GREAT PLANS.</p>
            <h1>
              Find your next <em className="m-serif">raunak.</em>
            </h1>
            <p>Find something worth showing up for.</p>
          </div>
          <Link href="/saved" className="r-quiet-button">
            Saved events ♡
          </Link>
        </section>
        <DiscoverFilters
          key={JSON.stringify(parsed.data)}
          filters={parsed.data}
          availableCities={locations.flatMap((v) => (v.city ? [v.city] : []))}
        />
        <div className="d-results-heading">
          <div>
            <h2>
              {parsed.data.mode === "ONLINE"
                ? "Online events"
                : parsed.data.city
                  ? `Events in ${parsed.data.city}`
                  : parsed.data.lat !== undefined
                    ? "Events near your location"
                    : "Explore upcoming events"}
            </h2>
            <p>
              {result.total} {result.total === 1 ? "event" : "events"} · page{" "}
              {parsed.data.page}
            </p>
          </div>
          <Link href="/discover" className="d-clear">
            Reset filters ×
          </Link>
        </div>
        {result.events.length ? (
          <ul className="market-grid">
            {result.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                saved={saved.some((v) => v.eventId === event.id)}
              />
            ))}
          </ul>
        ) : (
          <section className="market-empty">
            <h2>No events match this search.</h2>
            <p>Try all cities, another date or a broader price range.</p>
            <Link href="/discover" className="m-button m-button-small">
              Explore all events ↗
            </Link>
          </section>
        )}
        <nav className="ops-pagination" aria-label="Event result pages">
          {parsed.data.page > 1 && (
            <Link
              href={discoveryUrl(parsed.data, { page: parsed.data.page - 1 })}
            >
              ← Previous
            </Link>
          )}
          <span>{result.total} events</span>
          {parsed.data.page * 12 < result.total && (
            <Link
              href={discoveryUrl(parsed.data, { page: parsed.data.page + 1 })}
            >
              Next →
            </Link>
          )}
        </nav>
      </main>
      <MarketingFooter />
    </>
  );
}
