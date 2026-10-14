import type { Metadata } from "next";
import Link from "next/link";
import { EventImage } from "@/components/public/event-image";
import { PublicHeader } from "@/components/public/public-header";
import { MarketingFooter } from "@/components/marketing/footer";
import { discoverEvents } from "@/server/public/events";
import { formatInr } from "@/lib/money";
import { eventCategories } from "@/config/event-options";
export const metadata: Metadata = {
  title: "Discover events | Raunak",
  description: "Good people. Great events. Find your next plan on Raunak.",
};
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    city?: string;
    category?: string;
    from?: string;
  }>;
}) {
  const raw = await searchParams;
  const filters = {
    q: raw.q?.slice(0, 100),
    city: raw.city?.slice(0, 100),
    category: raw.category?.slice(0, 80),
    from:
      /^\d{4}-\d{2}-\d{2}$/.test(raw.from || "") &&
      !Number.isNaN(Date.parse(raw.from!))
        ? raw.from
        : undefined,
  };
  const events = await discoverEvents(filters);
  return (
    <>
      <PublicHeader />
      <main className="r-discover">
        <section className="r-discover-hero">
          <p className="m-eyebrow">GOOD PLANS START HERE</p>
          <h1>
            Step out.
            <br />
            <em className="m-serif">Find your people.</em>
          </h1>
          <p>
            A workshop, a late-night gig, a new favourite memory. There’s a
            little raunak waiting for you.
          </p>
        </section>
        <form className="r-search">
          <label>
            What are you into?
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Music, workshops, a good idea…"
            />
          </label>
          <label>
            City
            <input
              name="city"
              defaultValue={filters.city}
              placeholder="Anywhere"
            />
          </label>
          <label>
            Category
            <select name="category" defaultValue={filters.category || ""}>
              <option value="">All categories</option>
              {filters.category && !eventCategories.includes(filters.category) && <option>{filters.category}</option>}
              {eventCategories.map(category => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            From date
            <input name="from" type="date" defaultValue={filters.from} />
          </label>
          <button className="m-button">Find a plan ↗</button>
        </form>
        <div className="r-discover-heading">
          <h2>Worth showing up for.</h2>
          <span className="m-mono">
            {events.length} {events.length === 1 ? "EVENT" : "EVENTS"}
          </span>
          <Link href="/discover">Clear filters ↗</Link>
        </div>
        {events.length ? (
          <ul className="r-event-grid">
            {events.map((event) => (
              <li key={event.id}>
                <Link href={`/e/${event.slug}`} className="r-event-card">
                  <EventImage
                    variants={event.images[0]?.variants}
                    alt={event.images[0]?.alt || `${event.title} poster`}
                    size="card"
                    className="r-event-poster"
                  />
                  <div>
                    <span className="m-eyebrow">
                      {event.category || "GET TOGETHER"}
                    </span>
                    <h2>{event.title}</h2>
                    <p>
                      {new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                        timeZone: event.timezone,
                      }).format(event.startsAt)}{" "}
                      · {event.city || "Online"}
                    </p>
                    <strong>
                      {event.ticketTypes.length
                        ? `From ${formatInr(Math.min(...event.ticketTypes.map((type) => type.pricePaise)))}`
                        : "Tickets soon"}
                      <span aria-hidden="true">↗</span>
                    </strong>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <section className="r-account-empty">
            <span aria-hidden="true">✳</span>
            <h3>A little room for a new plan.</h3>
            <p>
              No events match this search yet. Try another city or be the one to
              bring people together.
            </p>
            <Link href="/discover" className="m-button">
              Explore all events ↗
            </Link>
            <Link href="/dashboard" className="m-text-link">
              Host your own event ↗
            </Link>
          </section>
        )}
      </main>
      <MarketingFooter />
    </>
  );
}
