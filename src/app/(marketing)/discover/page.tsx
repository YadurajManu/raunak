import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketingFooter } from "@/components/marketing/footer";
import { DiscoverFilters } from "@/components/public/discover-filters";
import { EventCard } from "@/components/public/event-card";
import { discoverPage, publicListing } from "@/server/public/events";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { discoverySchema, discoveryUrl } from "@/lib/discovery";
import { discoverySections } from "@/lib/discovery-sections";
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
        <main className="market-page">
          <h1>Let’s adjust those filters.</h1>
          <p role="alert">{parsed.error.issues[0].message}</p>
          <Link className="m-button" href="/discover">
            Reset filters
          </Link>
        </main>
      </>
    );
  if (
    parsed.data.mode === "ONLINE" &&
    (raw.city || raw.lat || raw.lng || raw.radius)
  )
    redirect(
      discoveryUrl(parsed.data, {
        page: parsed.data.page > 1 ? parsed.data.page : undefined,
      }),
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
  const unfiltered =
    !parsed.data.q &&
    !parsed.data.city &&
    !parsed.data.category &&
    !parsed.data.period &&
    !parsed.data.from &&
    !parsed.data.to &&
    !parsed.data.mode &&
    !parsed.data.price &&
    parsed.data.min === undefined &&
    parsed.data.max === undefined &&
    parsed.data.lat === undefined &&
    !parsed.data.organizer &&
    raw.sort === undefined &&
    parsed.data.sort === "soonest" &&
    parsed.data.page === 1;
  const groups = unfiltered
    ? discoverySections(result.events, user?.city)
    : { primary: result.events, sections: [] };
  const lowInventory = unfiltered && result.total > 0 && result.total <= 3;
  return (
    <>
      <main className="market-page d-discover">
        <section className="d-hero">
          <div>
            <p className="m-eyebrow">GOOD PEOPLE. GREAT PLANS.</p>
            <h1>
              Find your next <em className="m-serif">raunak.</em>
            </h1>
            <p>Find your people. Make a good plan.</p>
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
                    : parsed.data.mode === "IN_PERSON"
                      ? "In-person events"
                      : parsed.data.mode === "HYBRID"
                        ? "Hybrid events"
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
          <div className={lowInventory ? "d-low-inventory" : undefined}>
            <ul className="market-grid">
              {groups.primary.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  saved={saved.some((v) => v.eventId === event.id)}
                />
              ))}
            </ul>
            {lowInventory && (
              <aside className="d-host-invitation">
                <span aria-hidden="true">✳</span>
                <p className="m-eyebrow">MAKE SOMETHING HAPPEN</p>
                <h2>Good company starts with an invitation.</h2>
                <p>
                  A workshop, a gig, a gathering of your own. There’s room for
                  your idea here.
                </p>
                <Link href="/dashboard" className="m-button m-button-small">
                  Host your first event ↗
                </Link>
                <small>Your first event is free to host.</small>
              </aside>
            )}
          </div>
        ) : (
          <section className="market-empty">
            <h2>
              {unfiltered
                ? "Good plans are on their way."
                : "No events match this search."}
            </h2>
            <p>
              {unfiltered
                ? "No upcoming public events yet. Bring people together with a gathering of your own."
                : "Try all cities, another date or a broader price range."}
            </p>
            <Link href="/discover" className="m-button m-button-small">
              Explore all events ↗
            </Link>
            <Link href="/dashboard" className="d-empty-host">
              Host an event ↗
            </Link>
          </section>
        )}
        {groups.sections.map((section) => (
          <section className="d-context-section" key={section.title}>
            <header>
              <h2>{section.title}</h2>
              <Link href={section.href}>Explore more ↗</Link>
            </header>
            <ul className="market-grid">
              {section.events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  saved={saved.some((item) => item.eventId === event.id)}
                />
              ))}
            </ul>
          </section>
        ))}
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
