import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { publicListing } from "@/server/public/events";
import { RouteFooter } from "@/components/marketing/footer";

async function cityEvents(city: string) {
  if (!city || city.length > 100) notFound();
  return db.event.findMany({ where: { ...publicListing, city: { equals: city, mode: "insensitive" }, startsAt: { gte: new Date() } }, select: { title: true, slug: true, startsAt: true, city: true, updatedAt: true }, orderBy: { startsAt: "asc" }, take: 100 });
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const events = await cityEvents(city);
  if (!events.length) return { title: "City not found | Raunak", robots: { index: false } };
  const name = events[0].city || city;
  return { title: `Events in ${name} | Tickets and listings | Raunak`, description: `Find upcoming public events in ${name} on Raunak. Browse event details, compare ticket options and book online for QR ticket check-in.`, alternates: { canonical: `/cities/${encodeURIComponent(name)}` } };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const events = await cityEvents(city);
  if (!events.length) notFound();
  const name = events[0].city || city;
  const base = "https://raunak.yaduraj.me";
  const data = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: `Events in ${name}`, url: `${base}/cities/${encodeURIComponent(name)}`, mainEntity: { "@type": "ItemList", itemListElement: events.map((event, index) => ({ "@type": "ListItem", position: index + 1, name: event.title, url: `${base}/e/${event.slug}` })) } }, { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Discover", item: `${base}/discover` }, { "@type": "ListItem", position: 2, name, item: `${base}/cities/${encodeURIComponent(name)}` }] }];
  return <><main className="m-legal m-container"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} /><div className="m-legal-content"><nav aria-label="Breadcrumb"><Link href="/discover">Discover events</Link> / {name}</nav><h1>Upcoming events in {name}</h1><p>Browse published public events in {name}. Open an event to see its date, location, organizer, ticket options and refund policy before booking.</p><ul>{events.map((event) => <li key={event.slug}><Link href={`/e/${event.slug}`}>{event.title}</Link> — {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(event.startsAt)}</li>)}</ul><p><Link href="/discover">Browse all events</Link></p></div></main><RouteFooter pathname="/cities" /></>;
}
