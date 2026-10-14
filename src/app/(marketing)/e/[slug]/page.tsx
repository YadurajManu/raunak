import { VenueMap } from "@/components/public/venue-map";
import { documentsSchema } from "@/server/events/documents";
import { PublicHeader } from "@/components/public/public-header";
import { MarketingFooter } from "@/components/marketing/footer";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { APP_NAME } from "@/lib/constants";
import { formatInr } from "@/lib/money";
import { variantUrl } from "@/lib/images";
import { EventImage } from "@/components/public/event-image";
import { publicEvent } from "@/server/public/events";
import { TicketSelector } from "@/components/public/ticket-selector";

const base = process.env.APP_URL || "http://localhost:3000";
function eventDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await publicEvent(slug);
  if (!event) return { title: "Event not found" };
  const poster = event.images.find((image) => image.kind === "POSTER") || event.images.find((image) => image.kind === "COVER");
  const shareImage = variantUrl(poster?.variants, "og");
  const description =
    event.summary ||
    `${event.title} · ${eventDate(event.startsAt, event.timezone)}`;
  const url = `${base}/e/${event.slug}`;
  return {
    title: `${event.title} | ${APP_NAME}`,
    description,
    alternates: { canonical: url },
    robots:
      event.visibility === "UNLISTED"
        ? { index: false, follow: false }
        : undefined,
    openGraph: {
      type: "website",
      title: event.title,
      description,
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      ...(shareImage ? { images: [new URL(shareImage, base).href] } : {}),
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const event = await publicEvent((await params).slug);
  if (!event) notFound();
  const poster = event.images.find((image) => image.kind === "POSTER");
  const gallery = event.images.filter(
    (image) => image.kind === "GALLERY" || image.kind === "COVER",
  );
  const location =
    [event.venueName, event.city].filter(Boolean).join(", ") || "Online";
  const minPrice = event.ticketTypes
    .filter((type) => !type.isHidden)
    .map((type) => type.pricePaise);
  const offer = event.ticketTypes
    .filter((type) => !type.isHidden)
    .map((type) => ({
      "@type": "Offer",
      name: type.name,
      price: (type.pricePaise / 100).toFixed(2),
      priceCurrency: "INR",
      availability:
        type.quantitySold + type.quantityHeld >= type.quantityTotal
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
      url: `${base}/e/${event.slug}`,
    }));
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.summary || event.description || "",
    startDate: event.startsAt.toISOString(),
    endDate: event.endsAt.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode:
      event.mode === "ONLINE"
        ? "https://schema.org/OnlineEventAttendanceMode"
        : event.mode === "HYBRID"
          ? "https://schema.org/MixedEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
    location:
      event.mode === "ONLINE"
        ? { "@type": "VirtualLocation", url: `${base}/e/${event.slug}` }
        : {
            "@type": "Place",
            name: event.venueName,
            address: {
              "@type": "PostalAddress",
              streetAddress: event.address,
              addressLocality: event.city,
              addressCountry: "IN",
            },
          },
    image: variantUrl(poster?.variants, "og"),
    organizer: { "@type": "Organization", name: event.org.name },
    offers: offer,
  };
  return (
    <main className="r-event-detail min-h-screen pb-24 sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-6">
        <div className="overflow-hidden rounded-3xl">
          <EventImage
            variants={poster?.variants}
            alt={poster?.alt || `${event.title} poster`}
            size="hero"
            className="aspect-[16/7] w-full object-cover"
          />
        </div>
        <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)] dark:text-[var(--accent)]">
              {event.category || "Event"}
            </p>
            <h1 className="r-event-title">{event.title}</h1>
            {event.summary && (
              <p className="mt-5 max-w-2xl text-lg text-[var(--muted)] dark:text-[var(--muted)]">
                {event.summary}
              </p>
            )}
            <div className="mt-8 grid gap-4 rounded-2xl border border-[var(--line)] p-5 text-sm dark:border-[var(--line)] sm:grid-cols-3">
              <div>
                <p className="text-[var(--muted)]">When</p>
                <p className="mt-1 font-medium">
                  {eventDate(event.startsAt, event.timezone)}
                </p>
              </div>
              <div>
                <p className="text-[var(--muted)]">Where</p>
                <p className="mt-1 font-medium">{location}</p>
              </div>
              <div>
                <p className="text-[var(--muted)]">Tickets</p>
                <p className="mt-1 font-medium">
                  {minPrice.length
                    ? `From ${formatInr(Math.min(...minPrice))}`
                    : "Unavailable"}
                </p>
              </div>
            </div>
            {event.description && (
              <section className="mt-12" id="about">
                <h2 className="text-2xl font-semibold">About</h2>
                <div className="prose prose-zinc mt-5 max-w-none dark:prose-invert">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {event.description}
                  </Markdown>
                </div>
              </section>
            )}
            {event.people.length > 0 && (
              <section className="mt-12" id="lineup">
                <h2 className="text-2xl font-semibold">People</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {event.people.map((person) => {
                    const photo = event.images.find(
                      (image) => image.storageKey === person.photoKey,
                    );
                    return (
                      <div
                        key={person.id}
                        className="flex gap-4 rounded-2xl border border-[var(--line)] p-4 dark:border-[var(--line)]"
                      >
                        <EventImage
                          variants={photo?.variants}
                          alt={photo?.alt || person.name}
                          size="thumb"
                          className="h-20 w-20 shrink-0 rounded-xl object-cover"
                        />
                        <div>
                          <h3 className="font-semibold">{person.name}</h3>
                          {person.title && (
                            <p className="text-sm text-[var(--accent)] dark:text-[var(--accent)]">
                              {person.title}
                            </p>
                          )}
                          {person.bio && (
                            <p className="mt-2 text-sm text-[var(--muted)] dark:text-[var(--muted)]">
                              {person.bio}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            {gallery.length > 0 && (
              <section className="mt-12" id="gallery">
                <h2 className="text-2xl font-semibold">Gallery</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {gallery.map((image) => (
                    <EventImage
                      key={image.id}
                      variants={image.variants}
                      alt={image.alt || event.title}
                      size="card"
                      className="aspect-[4/3] w-full rounded-2xl object-cover"
                    />
                  ))}
                </div>
              </section>
            )}
            {event.mode !== "ONLINE" && (
              <section className="mt-12" id="venue">
                <h2 className="text-2xl font-semibold">Venue</h2>
                <p className="mt-4 font-medium">{location}</p>
                {event.address && (
                  <p className="mt-1 text-[var(--muted)] dark:text-[var(--muted)]">
                    {event.address}
                  </p>
                )}
                {event.lat != null && event.lng != null && (
                  <VenueMap
                    latitude={Number(event.lat)}
                    longitude={Number(event.lng)}
                  />
                )}
                {event.mapUrl && (
                  <a
                    href={event.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-[var(--accent)] underline dark:text-[var(--accent)]"
                  >
                    Open map
                  </a>
                )}
              </section>
            )}
            {documentsSchema.parse(event.documents).length > 0 && (
              <section className="r-settings-card">
                <h2>Good to know before you go.</h2>
                <ul>
                  {documentsSchema.parse(event.documents).map((document) => (
                    <li className="r-document-row" key={document.id}>
                      <a
                        href={`/api/events/${event.id}/documents/${document.id}`}
                      >
                        {document.name} · Download PDF ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {event.refundPolicy && (
              <section className="mt-12" id="refunds">
                <h2 className="text-2xl font-semibold">Refund policy</h2>
                <p className="mt-4 whitespace-pre-wrap text-[var(--muted)] dark:text-[var(--muted)]">
                  {event.refundPolicy}
                </p>
              </section>
            )}
          </article>
          <aside id="tickets">
            <TicketSelector
              eventId={event.id}
              eventSlug={event.slug}
              startsAt={event.startsAt.toISOString()}
              ticketTypes={event.ticketTypes.map((type) => ({
                id: type.id,
                name: type.name,
                description: type.description,
                pricePaise: type.pricePaise,
                quantityTotal: type.quantityTotal,
                quantitySold: type.quantitySold,
                quantityHeld: type.quantityHeld,
                saleStartsAt: type.saleStartsAt?.toISOString() || null,
                saleEndsAt: type.saleEndsAt?.toISOString() || null,
                minPerOrder: type.minPerOrder,
                maxPerOrder: type.maxPerOrder,
                isHidden: type.isHidden,
              }))}
            />
          </aside>
        </div>
      </div>
      <footer className="border-t border-[var(--line)] px-6 py-8 text-center text-sm text-[var(--muted)] dark:border-[var(--line)]">
        {event.org.name} ·{" "}
        {event.org.supportEmail || event.org.supportPhone || APP_NAME}
      </footer>
      <MarketingFooter />
    </main>
  );
}
