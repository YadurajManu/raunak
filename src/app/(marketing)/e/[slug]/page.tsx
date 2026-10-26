import { VenueMap } from "@/components/public/venue-map";
import { db } from "@/server/db/client";
import { EventCard } from "@/components/public/event-card";
import { EventActionToolbar } from "@/components/public/event-action-toolbar";
import { eventCalendarOptions } from "@/lib/event-calendar";
import { documentsSchema } from "@/server/events/documents";
import { RouteFooter } from "@/components/marketing/footer";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { APP_NAME } from "@/lib/constants";
import { variantUrl } from "@/lib/images";
import { EventImage } from "@/components/public/event-image";
import { EventGallery } from "@/components/public/event-gallery";
import Link from "next/link";
import Image from "next/image";
import { publicEvent, discoverPage } from "@/server/public/events";
import { TicketSelector } from "@/components/public/ticket-selector";
import { organizerLogoUrl } from "@/lib/organizer-images";
import { eventReviewSnapshot } from "@/server/events/reviews";
import { ContactOrganizerForm } from "@/components/public/contact-organizer-form";
import {
  EventManagementBar,
  EventReviewsForViewer,
  EventViewerProvider,
} from "@/components/public/event-viewer";
import { VenueActions } from "@/components/public/venue-actions";
import { discoveryUrl } from "@/lib/discovery";
import { CalendarDays, MapPin } from "lucide-react";

const base = process.env.APP_URL || "http://localhost:3000";
function eventDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

function eventDateRange(startsAt: Date, endsAt: Date, timezone: string) {
  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  });
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  const zone = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    timeZoneName: "short",
  })
    .formatToParts(startsAt)
    .find((part) => part.type === "timeZoneName")?.value;
  const sameDay = date.format(startsAt) === date.format(endsAt);
  return `${date.format(startsAt)} · ${time.format(startsAt)}–${time.format(endsAt)}${zone ? ` ${zone}` : ""}${sameDay ? "" : ` · ends ${date.format(endsAt)}`}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await publicEvent(slug);
  if (!event) return { title: "Event not found" };
  const poster =
    event.images.find((image) => image.kind === "POSTER") ||
    event.images.find((image) => image.kind === "COVER");
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const event = await publicEvent((await params).slug);
  if (!event) notFound();
  const previewAsVisitor = (await searchParams).preview === "visitor";
  const organizerHasContact = Boolean(
    (
      await db.organization.findUnique({
        where: { id: event.orgId },
        select: { supportEmail: true },
      })
    )?.supportEmail,
  );
  const eventHasEnded = event.status === "ENDED" || event.endsAt <= new Date();
  const eventHasStarted = event.startsAt <= new Date();
  const reviews =
    event.visibility === "PUBLIC"
      ? await eventReviewSnapshot(event, null)
      : null;
  const [hostEvents, nearbyEvents] =
    event.visibility === "PUBLIC"
      ? await Promise.all([
          discoverPage({ organizer: event.org.slug }).then((page) =>
            page.events.filter((item) => item.id !== event.id).slice(0, 3),
          ),
          discoverPage({
            category: event.category || "",
            city: event.mode === "ONLINE" ? "" : event.city || "",
          }).then((page) => page.events.filter((item) => item.id !== event.id)),
        ])
      : [[], []];
  const followerCount = await db.organizationFollower.count({
    where: { orgId: event.org.id },
  });
  const relatedNear = nearbyEvents
    .filter((item) => !hostEvents.some((host) => host.id === item.id))
    .slice(0, 3);
  const poster = event.images.find((image) => image.kind === "POSTER");
  const gallery = event.images.filter(
    (image) => image.kind === "GALLERY" || image.kind === "COVER",
  );
  const location =
    [event.venueName, event.city].filter(Boolean).join(", ") || "Online";
  const cityHref = event.city
    ? discoveryUrl({ city: event.city })
    : "/discover";
  const categoryHref = event.category
    ? discoveryUrl({ category: event.category })
    : "/discover";
  const venueQuery = [event.venueName, event.address, event.city]
    .filter(Boolean)
    .join(", ");
  const eventSummaryDate = `${new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: event.timezone }).format(event.startsAt)} · ${new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(event.startsAt)} · ${event.city || "Online"}`;
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
    eventStatus: eventHasEnded
      ? "https://schema.org/EventCompleted"
      : "https://schema.org/EventScheduled",
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
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Discover",
        item: `${base}/discover`,
      },
      ...(event.city
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: event.city,
              item: `${base}${cityHref}`,
            },
          ]
        : []),
      ...(event.category
        ? [
            {
              "@type": "ListItem",
              position: event.city ? 3 : 2,
              name: event.category,
              item: `${base}${categoryHref}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: (event.city ? 2 : 1) + (event.category ? 1 : 0) + 1,
        name: event.title,
        item: `${base}/e/${event.slug}`,
      },
    ],
  };
  return (
    <EventViewerProvider eventId={event.id}>
      <main className="r-event-detail min-h-screen pb-24 sm:pb-0">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c"),
          }}
        />
        <div className="mx-auto max-w-6xl px-6 pt-3 sm:pt-5">
        <EventManagementBar hidden={previewAsVisitor} />
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
              <nav aria-label="Breadcrumb" className="event-breadcrumb">
                <Link href="/discover">Discover</Link>
                {event.city && (
                  <>
                    <span aria-hidden="true">›</span>
                    <Link href={cityHref}>{event.city}</Link>
                  </>
                )}
                {event.category && (
                  <>
                    <span aria-hidden="true">›</span>
                    <Link href={categoryHref}>{event.category}</Link>
                  </>
                )}
                <span aria-hidden="true">›</span>
                <span aria-current="page" className="event-breadcrumb-current">
                  {event.title}
                </span>
              </nav>
              <h1 className="r-event-title">{event.title}</h1>
              <EventActionToolbar
                eventId={event.id}
                title={event.title}
                url={`${base}/e/${event.slug}`}
              organizer={{
                name: event.org.name,
                slug: event.org.slug,
                avatarUrl: organizerLogoUrl(event.org.id, event.org.logoKey),
              }}
              organizerId={event.org.id}
              followerCount={followerCount}
                saved={false}
                saveAvailable={event.visibility === "PUBLIC"}
                calendar={eventCalendarOptions(
                  event,
                  `${base}/e/${event.slug}`,
                )}
              />
              {event.summary && (
                <p className="mt-5 max-w-2xl text-lg text-[var(--muted)] dark:text-[var(--muted)]">
                  {event.summary}
                </p>
              )}
            <div className="mt-8 grid gap-4 rounded-2xl border border-[var(--line)] p-5 text-sm dark:border-[var(--line)]">
                <div className="event-primary-facts">
                  <p className="event-fact-label">
                    <CalendarDays size={16} aria-hidden="true" /> When
                  </p>
                  <p className="event-fact-value">
                    {eventDateRange(
                      event.startsAt,
                      event.endsAt,
                      event.timezone,
                    )}
                  </p>
                </div>
                <div className="event-primary-facts">
                  <p className="event-fact-label">
                    <MapPin size={16} aria-hidden="true" /> Where
                  </p>
                  <p className="event-fact-value">{location}</p>
                  {event.mode !== "ONLINE" && venueQuery && (
                    <a
                      className="event-fact-link"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venueQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Directions
                    </a>
                  )}
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
              {event.people.filter(
                (person) =>
                  ![
                    "owner",
                    "admin",
                    "manager",
                    "organizer",
                    "finance",
                    "check-in",
                    "checkin",
                  ].includes((person.title || "").trim().toLowerCase()),
              ).length > 0 && (
                <section className="mt-12" id="lineup">
                  <h2 className="text-2xl font-semibold">People</h2>
                  <div className="event-people-grid">
                    {event.people
                      .filter(
                        (person) =>
                          ![
                            "owner",
                            "admin",
                            "manager",
                            "organizer",
                            "finance",
                            "check-in",
                            "checkin",
                          ].includes((person.title || "").trim().toLowerCase()),
                      )
                      .map((person) => {
                        const photo = event.images.find(
                          (image) => image.storageKey === person.photoKey,
                        );
                        return (
                          <article key={person.id} className="event-person">
                            {photo?.variants ? (
                              <EventImage
                                variants={photo.variants}
                                alt={photo.alt || person.name}
                                size="thumb"
                                className="event-person-photo"
                              />
                            ) : (
                              <div
                                className="event-person-fallback"
                                aria-hidden="true"
                              >
                                {person.name
                                  .trim()
                                  .split(/\s+/)
                                  .slice(0, 2)
                                  .map((part) => part[0])
                                  .join("")
                                  .toUpperCase()}
                              </div>
                            )}
                            <div>
                              <h3 className="font-semibold">{person.name}</h3>
                              {person.title && (
                                <p className="text-sm text-[var(--accent)] dark:text-[var(--accent)]">
                                  {person.title}
                                </p>
                              )}
                              {person.bio && (
                                <p className="event-person-bio">{person.bio}</p>
                              )}
                            </div>
                          </article>
                        );
                      })}
                  </div>
                </section>
              )}
              {gallery.length > 0 && (
                <EventGallery
                  photos={gallery.map((image) => ({
                    id: image.id,
                    variants: image.variants,
                    alt: image.alt || event.title,
                  }))}
                />
              )}
              {event.mode !== "ONLINE" && (
                <section className="mt-12" id="venue">
                  <h2 className="text-2xl font-semibold">Venue</h2>
                  <div className="event-venue-grid">
                    <div className="event-venue-copy">
                      <p className="font-semibold">
                        {event.venueName || event.city}
                      </p>
                      {event.address && (
                        <p className="mt-2 text-[var(--muted)]">
                          {event.address}
                        </p>
                      )}
                      <VenueActions
                        query={venueQuery}
                        address={
                          event.address ||
                          [event.venueName, event.city]
                            .filter(Boolean)
                            .join(", ")
                        }
                      />
                      {event.mapUrl && (
                        <a
                          className="event-map-link"
                          href={event.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Venue map shared by the organizer
                        </a>
                      )}
                      {event.venueNotes && (
                        <div className="event-how-to-reach">
                          <h3>How to reach</h3>
                          <p>{event.venueNotes}</p>
                        </div>
                      )}
                    </div>
                    {event.lat != null && event.lng != null && (
                      <VenueMap
                        latitude={Number(event.lat)}
                        longitude={Number(event.lng)}
                      />
                    )}
                  </div>
                </section>
              )}
              {event.mode !== "IN_PERSON" && (
                <section className="mt-12 event-online-info" id="online">
                  <h2 className="text-2xl font-semibold">Joining online</h2>
                  <p>
                    Joining details are shared privately with ticket holders
                    after booking.
                  </p>
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
              <section
                className="mt-12 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 dark:border-[var(--line)]"
                id="organizer"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                  Hosted by
                </p>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <Link
                      href={`/organizers/${event.org.slug}`}
                      className="shrink-0"
                    >
                      {organizerLogoUrl(event.org.id, event.org.logoKey) ? (
                        <Image
                          src={organizerLogoUrl(
                            event.org.id,
                            event.org.logoKey,
                          )!}
                          alt={event.org.name}
                          width={64}
                          height={64}
                          unoptimized
                          className="h-16 w-16 rounded-2xl border-2 border-[var(--line)] object-cover shadow-sm"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[var(--line)] bg-[var(--surface-raised)] font-serif text-2xl font-bold text-[var(--accent)]">
                          {event.org.name.charAt(0)}
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0">
                      <Link
                        href={`/organizers/${event.org.slug}`}
                        className="text-lg font-semibold hover:underline"
                      >
                        {event.org.name}
                      </Link>
                      {event.org.tagline && (
                        <p className="mt-0.5 line-clamp-1 text-sm text-[var(--muted)]">
                          {event.org.tagline}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {followerCount}{" "}
                        {followerCount === 1 ? "follower" : "followers"} ·{" "}
                        <Link
                          href={`/organizers/${event.org.slug}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          View profile →
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
                {event.org.bio && (
                  <p className="mt-4 border-t border-[var(--line)] pt-4 text-sm leading-relaxed text-[var(--muted)]">
                    {event.org.bio}
                  </p>
                )}
                {organizerHasContact && (
                  <ContactOrganizerForm
                    eventId={event.id}
                    organizerName={event.org.name}
                  />
                )}
              </section>
            {reviews && (eventHasStarted || reviews.reviewCount > 0) && (
                <EventReviewsForViewer
                  eventId={event.id}
                  eventUrl={`${base}/e/${event.slug}`}
                  reviewOpen={reviews.reviewOpen}
                  reviews={reviews.reviews}
                  averageRating={reviews.averageRating}
                  reviewCount={reviews.reviewCount}
                />
              )}
            </article>
            <aside id="tickets">
              {eventHasEnded ? (
                <div className="rounded-2xl border border-[var(--line)] p-5">
                  <h2 className="text-xl font-semibold">
                    This event has ended
                  </h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Attendees with a paid booking can share a review below.
                  </p>
                </div>
              ) : (
                <TicketSelector
                  eventId={event.id}
                  eventSlug={event.slug}
                  timezone={event.timezone}
                  startsAt={event.startsAt.toISOString()}
                  recap={eventSummaryDate}
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
              )}
            </aside>
          </div>
        </div>
        {hostEvents.length > 0 && (
          <section className="market-page event-related-section">
            <h2>More from {event.org.name}</h2>
            <ul className="market-grid">
              {hostEvents.map((item) => (
                <EventCard key={item.id} event={item} saved={false} />
              ))}
            </ul>
          </section>
        )}
        {relatedNear.length > 0 && (
          <section className="market-page event-related-section">
            <h2>Similar events near {event.city || "you"}</h2>
            <ul className="market-grid">
              {relatedNear.map((item) => (
                <EventCard key={item.id} event={item} saved={false} />
              ))}
            </ul>
          </section>
        )}
      </main>
      <RouteFooter pathname="/e/[slug]" />
    </EventViewerProvider>
  );
}
