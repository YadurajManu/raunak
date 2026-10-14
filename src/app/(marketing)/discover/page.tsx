import type { Metadata } from "next";
import Link from "next/link";
import { EventImage } from "@/components/public/event-image";
import { PublicHeader } from "@/components/public/public-header";
import { MarketingFooter } from "@/components/marketing/footer";
import { DiscoverFilters } from "@/components/public/discover-filters";
import { discoverEvents } from "@/server/public/events";
import { db } from "@/server/db/client";
import { formatInr } from "@/lib/money";
import { dateChoices } from "@/lib/discovery-dates";
export const metadata: Metadata = { title: "Discover events | Raunak", description: "Good people. Great events. Find your next plan on Raunak." };
export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string; city?: string; category?: string; from?: string; period?: string }> }) {
  const raw = await searchParams;
  const filters = {
    q: raw.q?.slice(0,100), city: raw.city?.slice(0,100), category: raw.category?.slice(0,80),
    from: /^\d{4}-\d{2}-\d{2}$/.test(raw.from || "") && !Number.isNaN(Date.parse(raw.from!)) && new Date(raw.from!).toISOString().startsWith(raw.from!) ? raw.from : undefined,
    period: dateChoices.find(period => period === raw.period),
  };
  const [events, locations] = await Promise.all([discoverEvents(filters), db.event.findMany({ where: { status:"PUBLISHED", visibility:"PUBLIC", deletedAt:null, startsAt:{gte:new Date()}, city:{not:null} }, distinct:["city"], select:{city:true}, take:100 })]);
  const filtered = Object.values(filters).some(Boolean);
  return <><PublicHeader/><main className="r-discover d-discover">
    <section className="d-hero"><div><p className="m-eyebrow">GOOD PEOPLE. GREAT PLANS.</p><h1>Find your next <em className="m-serif">raunak.</em></h1><p>Gigs, gatherings and something new. Make a plan worth showing up for.</p></div><Link href="/dashboard" className="d-host">Bring people together <span aria-hidden="true">↗</span></Link></section>
    <DiscoverFilters key={JSON.stringify(filters)} filters={filters} availableCities={locations.flatMap(v => v.city ? [v.city] : [])}/>
    <div className="d-results-heading"><div><h2>{filters.city ? `Events in ${filters.city}` : "Explore upcoming events"}</h2><p>{events.length}{events.length === 100 ? "+" : ""} {events.length === 1 ? "event" : "events"} · {filters.period ? {today:"Today",tomorrow:"Tomorrow",weekend:"This weekend",month:"This month"}[filters.period] : filters.from ? `From ${filters.from}` : "Soonest first"}</p></div>{filtered && <Link href="/discover" className="d-clear">Clear all filters ×</Link>}</div>
    {events.length ? <ul className="r-event-grid d-event-grid">{events.map(event => { const prices = event.ticketTypes.map(t => t.pricePaise); const minimum = prices.length ? Math.min(...prices) : null; return <li key={event.id}><Link href={`/e/${event.slug}`} className="r-event-card"><EventImage variants={event.images[0]?.variants} alt={event.images[0]?.alt || `${event.title} poster`} size="card" className="r-event-poster"/><div><span className="m-eyebrow">{event.category || "GET TOGETHER"}</span><h3>{event.title}</h3><p className="d-event-date">{new Intl.DateTimeFormat("en-IN",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:event.timezone}).format(event.startsAt)}</p><p>{event.mode === "ONLINE" ? "Online" : [event.venueName,event.city].filter(Boolean).join(" · ") || "Venue to be announced"}</p><strong>{minimum === null ? "Tickets soon" : minimum === 0 ? "Free" : `From ${formatInr(minimum)}`}<span aria-hidden="true">↗</span></strong></div></Link></li>; })}</ul> : <section className="d-empty"><span aria-hidden="true">✳</span><div><h3>{filtered ? "No plans match these filters yet." : "Good plans are on their way."}</h3><p>{filtered ? "Try all cities, a different date or another category." : "There are no upcoming public events right now. Have an idea? Bring your people together."}</p></div><Link href={filtered ? "/discover" : "/dashboard"} className="m-button">{filtered ? "Show all events ↗" : "Host an event ↗"}</Link></section>}
  </main><MarketingFooter/></>;
}
