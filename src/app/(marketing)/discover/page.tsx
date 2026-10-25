import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketingFooter } from "@/components/marketing/footer";
import { DiscoverFilters } from "@/components/public/discover-filters";
import { EventCard } from "@/components/public/event-card";
import { discoverPage, publicListing } from "@/server/public/events";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import {
  discoverySchema,
  discoveryUrl,
  discoveryFilterLabels,
} from "@/lib/discovery";
import { ArrowRight, CalendarDays, SearchX } from "lucide-react";
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
  const canonicalUrl = discoveryUrl(parsed.data, {
    page: parsed.data.page > 1 ? parsed.data.page : undefined,
  });
  const rawCategories = Array.isArray(raw.category)
    ? raw.category.join(",")
    : raw.category;
  const canonicalCategories = new URL(
    canonicalUrl,
    "https://raunak.local",
  ).searchParams.get("category");
  if (
    (raw.category !== undefined && rawCategories !== canonicalCategories) ||
    (parsed.data.mode === "ONLINE" &&
      (raw.city || raw.lat || raw.lng || raw.radius || raw.nearCity))
  )
    redirect(canonicalUrl);
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
  const appliedFilters = discoveryFilterLabels(parsed.data);
  const categorySummary = parsed.data.category.split("|").filter(Boolean);
  const placeSummary =
    parsed.data.city ||
    (parsed.data.lat !== undefined
      ? `${parsed.data.nearCity || "Nearby"} · ${parsed.data.radius} km`
      : "");
  const skippedSummary = new Set([
    ...categorySummary,
    ...(placeSummary ? [placeSummary] : []),
  ]);
  const activeFilterSummary = [
    ...(categorySummary.length ? [categorySummary.join(", ")] : []),
    placeSummary,
    ...appliedFilters.filter((label) => !skippedSummary.has(label)),
  ]
    .filter(Boolean)
    .join(" · ");
  // A filtered miss must not be confused with an empty public marketplace.
  const hasPublicEvents =
    result.total > 0 ||
    !!(await db.event.findFirst({
      where: { ...publicListing, startsAt: { gte: new Date() } },
      select: { id: true },
    }));
  return (
    <>
      <main className="market-page d-discover">
        <section className="d-hero">
          <div>
            <p className="m-eyebrow">GOOD PEOPLE. GREAT PLANS.</p>
            <h1>
              Find your next <em className="m-serif">raunak.</em>
            </h1>
          </div>
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
                    ? `Events near ${parsed.data.nearCity || "you"}`
                    : parsed.data.mode === "IN_PERSON"
                      ? "In-person events"
                      : parsed.data.mode === "HYBRID"
                        ? "Hybrid events"
                        : "Explore upcoming events"}
            </h2>
            <p>
              {result.total} {result.total === 1 ? "event" : "events"}
              {parsed.data.page > 1 && ` · page ${parsed.data.page}`}
              {activeFilterSummary && ` · ${activeFilterSummary}`}
            </p>
          </div>
          {appliedFilters.length > 0 && result.events.length > 0 && (
            <Link href="/discover?allCities=1" className="d-clear">
              Clear filters
            </Link>
          )}
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
                  Host your first event
                </Link>
                <small>Your first event is free to host.</small>
              </aside>
            )}
          </div>
        ) : (
          <section
            className="market-empty d-discovery-empty"
            aria-labelledby="discovery-empty-title"
          >
            <span className="d-empty-icon" aria-hidden="true">
              {hasPublicEvents ? (
                <SearchX size={22} />
              ) : (
                <CalendarDays size={22} />
              )}
            </span>
            <div>
              <h2 id="discovery-empty-title">
                {!hasPublicEvents
                  ? "Good plans are on their way."
                  : result.total > 0
                    ? "No events on this page."
                    : "No events match these filters."}
              </h2>
              <p>
                {!hasPublicEvents
                  ? "No upcoming public events yet. Bring people together with a gathering of your own."
                  : "Try another city, a different date or a broader price range."}
              </p>
              {hasPublicEvents && appliedFilters.length > 0 && (
                <ul className="d-applied-filters" aria-label="Selected filters">
                  {appliedFilters.map((label, index) => (
                    <li key={`${index}-${label}`}>{label}</li>
                  ))}
                </ul>
              )}
              <Link
                href={hasPublicEvents ? "/discover?allCities=1" : "/dashboard"}
                className="m-button m-button-small"
              >
                {hasPublicEvents ? "Clear filters" : "Host an event"}
                {hasPublicEvents && <ArrowRight size={16} aria-hidden="true" />}
              </Link>
            </div>
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
        {result.events.length > 0 && (
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
        )}
      </main>
      <MarketingFooter />
    </>
  );
}
