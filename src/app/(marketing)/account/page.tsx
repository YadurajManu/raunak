import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  MapPin,
  Ticket,
  SlidersHorizontal,
  BriefcaseBusiness,
  Star,
  Sparkles,
} from "lucide-react";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { discoverPage, publicListing } from "@/server/public/events";
import { EventImage } from "@/components/public/event-image";
import { EventCard } from "@/components/public/event-card";
import { SaveEvent } from "@/components/public/save-event";
import { AccountCity } from "@/components/onboarding/account-city";
import { walletWhere } from "@/lib/wallet";
import { discoveryUrl } from "@/lib/discovery";
import { cities } from "@/config/cities";
import { whatsappEventUrl } from "@/lib/event-share";

export const metadata = {
  title: "My plans | Raunak",
  robots: { index: false, follow: false },
};
const tabs = ["upcoming", "past", "saved", "orders", "settings"] as const;
const money = (paise: number) =>
  paise === 0
    ? "Free"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: paise % 100 ? 2 : 0,
      }).format(paise / 100);
const date = (
  value: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
) =>
  new Intl.DateTimeFormat("en-IN", { ...options, timeZone: timezone }).format(
    value,
  );

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; city?: string; page?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  if (!user.onboardingCompletedAt) redirect("/onboarding");
  const raw = await searchParams;
  const tab = tabs.find((value) => value === raw.tab) || "upcoming";
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(raw.page || "1", 10) || 1),
  );
  const now = new Date();
  const savedWhere = {
    userId: user.id,
    event: { ...publicListing, startsAt: { gt: now } },
  };
  const [
    tickets,
    orders,
    saved,
    upcomingCount,
    pastCount,
    savedCount,
    memberships,
    orderCount,
    cancelledCount,
    refundedCount,
  ] = await Promise.all([
    db.ticket.findMany({
      where: walletWhere(
        user.id,
        tab === "past" ? "past" : "upcoming",
        "",
        now,
      ),
      include: {
        event: {
          include: {
            images: { where: { kind: { in: ["POSTER", "COVER"] } }, take: 2 },
            org: { select: { name: true, slug: true, logoKey: true } },
          },
        },
        ticketType: true,
        order: {
          select: { status: true, _count: { select: { tickets: true } } },
        },
      },
      orderBy: { event: { startsAt: tab === "past" ? "desc" : "asc" } },
      take: 6,
    }),
    db.order.findMany({
      where: { buyerId: user.id },
      include: {
        event: true,
        items: { include: { ticketType: { select: { name: true } } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: tab === "orders" ? 12 : 3,
      skip: tab === "orders" ? (page - 1) * 12 : 0,
    }),
    db.savedEvent.findMany({
      where: savedWhere,
      orderBy: { createdAt: "desc" },
      take: tab === "saved" ? 6 : 2,
      include: {
        event: {
          include: {
            org: { select: { name: true, slug: true, logoKey: true } },
            images: { where: { kind: { in: ["POSTER", "COVER"] } }, take: 2 },
            ticketTypes: {
              where: { isHidden: false },
              select: { pricePaise: true },
            },
          },
        },
      },
    }),
    db.ticket.count({ where: walletWhere(user.id, "upcoming", "", now) }),
    db.ticket.count({ where: walletWhere(user.id, "past", "", now) }),
    db.savedEvent.count({ where: savedWhere }),
    db.organizationMember.findMany({
      where: { userId: user.id, status: "ACTIVE", org: { status: "ACTIVE" } },
      select: {
        org: {
          select: {
            id: true,
            name: true,
            _count: { select: { events: { where: { deletedAt: null } } } },
          },
        },
      },
      take: 3,
    }),
    db.order.count({ where: { buyerId: user.id } }),
    db.ticket.count({ where: walletWhere(user.id, "cancelled", "", now) }),
    db.ticket.count({ where: walletWhere(user.id, "refunded", "", now) }),
  ]);
  if (tab === "orders" && page > 1 && (page - 1) * 12 >= orderCount)
    redirect(
      `/account?tab=orders&page=${Math.max(1, Math.ceil(orderCount / 12))}`,
    );
  const nearest =
    user.locationConsentAt && user.latitude !== null && user.longitude !== null
      ? [...cities].sort((a, b) => {
          const distance = (city: typeof a) =>
            Math.pow(city.latitude - user.latitude!, 2) +
            Math.pow(
              (city.longitude - user.longitude!) *
                Math.cos((user.latitude! * Math.PI) / 180),
              2,
            );
          return distance(a) - distance(b);
        })[0]
      : undefined;
  const defaultHub =
    cities.find(
      (city) => city.city.toLowerCase() === user.city?.toLowerCase(),
    ) || nearest;
  const requestedCity = raw.city?.slice(0, 100);
  const hub =
    requestedCity === "all"
      ? undefined
      : cities.find((city) => city.city === requestedCity) || defaultHub;
  const discoveryInput = hub
    ? { lat: hub.latitude, lng: hub.longitude, nearCity: hub.city, radius: 50 }
    : {};
  const nearby = tab === "upcoming" ? await discoverPage(discoveryInput) : null;
  const fallback =
    nearby && nearby.total === 0 && hub ? await discoverPage({}) : nearby;
  const suggestions =
    (nearby?.total ? nearby : fallback)?.events.slice(0, 3) || [];
  const savedSuggestions = suggestions.length
    ? await db.savedEvent.findMany({
        where: {
          userId: user.id,
          eventId: { in: suggestions.map((event) => event.id) },
        },
        select: { eventId: true },
        take: 3,
      })
    : [];
  const grouped = new Map<string, typeof tickets>();
  for (const ticket of tickets) {
    const key = ticket.orderId;
    grouped.set(key, [...(grouped.get(key) || []), ticket]);
  }
  const orderStatus = (status: string) =>
    ({
      PAID: "Paid",
      PENDING: "Payment pending",
      PARTIALLY_REFUNDED: "Partially refunded",
      REFUNDED: "Refunded",
      FAILED: "Payment failed",
      EXPIRED: "Expired",
      CANCELLED: "Cancelled",
    })[status] || status;
  function renderOrders() {
    return (
      <section className="plans-section" aria-labelledby="plans-orders-title">
        <div className="plans-section-heading">
          <h2 id="plans-orders-title">
            {tab === "orders" ? "Your orders" : "Recent orders"}
          </h2>
          {tab !== "orders" && orders.length > 0 && (
            <Link href="/account?tab=orders">
              View orders <ArrowRight size={16} />
            </Link>
          )}
        </div>
        {orders.length ? (
          <div className="plans-orders">
            {orders.map((order) => (
              <article className="plans-order" key={order.id}>
                <div>
                  <h3>
                    <Link href={`/orders/${order.id}`}>
                      {order.event.title}
                    </Link>
                  </h3>
                  <p>
                    {order.items
                      .map(
                        (item) => `${item.quantity} × ${item.ticketType.name}`,
                      )
                      .join(" · ")}{" "}
                    ·{" "}
                    {date(order.createdAt, order.event.timezone, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <small>Booking {order.id.slice(0, 8).toUpperCase()}</small>
                </div>
                <strong>{money(order.totalPaise)}</strong>
                <span className="plans-status" data-status={order.status}>
                  {orderStatus(order.status)}
                </span>
                <Link
                  className="plans-order-action"
                  href={`/orders/${order.id}`}
                >
                  {order.status === "PENDING"
                    ? "Check payment"
                    : "View booking"}
                  <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="plans-empty-inline">
            <p>
              No bookings yet. Payment and refund details will appear here after
              you book.
            </p>
            <Link href="/discover">
              Find your first event <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
    );
  }
  function renderSaved() {
    return (
      <section className="plans-section" aria-labelledby="plans-saved-title">
        <div className="plans-section-heading">
          <h2 id="plans-saved-title">
            Saved for later <span>{savedCount}</span>
          </h2>
          {savedCount > 0 && (
            <Link href="/saved">
              View all saved <ArrowRight size={16} />
            </Link>
          )}
        </div>
        {saved.length ? (
          <ul
            className={`plans-saved-grid${tab === "saved" ? "" : " plans-saved-preview"}`}
          >
            {saved.map((item) => (
              <EventCard key={item.eventId} event={item.event} saved />
            ))}
          </ul>
        ) : (
          <div className="plans-empty-inline">
            <Heart size={22} aria-hidden="true" />
            <div>
              <h3>Keep a little room for a good plan.</h3>
              <p>
                Save events with the heart button. Find your upcoming favourites
                here.
              </p>
            </div>
            <Link href="/discover">
              Discover events <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
    );
  }
  return (
    <main className="plans-page" data-tab={tab}>
      <header className="plans-heading">
        <div>
          <p className="m-eyebrow">YOUR LITTLE CORNER</p>
          <h1>
            Hey, {user.name?.trim().split(/\s+/)[0] || "there"}.{" "}
            <em>Make a good plan.</em>
          </h1>
          <p>
            {upcomingCount} upcoming{" "}
            {upcomingCount === 1 ? "ticket" : "tickets"} · {savedCount} saved{" "}
            {savedCount === 1 ? "event" : "events"}
          </p>
        </div>
        <Link href="/discover" className="plans-button plans-primary">
          Explore events <ArrowRight size={17} />
        </Link>
      </header>
      <nav className="plans-tabs" aria-label="My plans">
        {tabs.map((value) => (
          <Link
            key={value}
            href={`/account${value === "upcoming" ? "" : `?tab=${value}`}`}
            aria-current={tab === value ? "page" : undefined}
          >
            {value.charAt(0).toUpperCase() + value.slice(1)}
            {["upcoming", "past", "saved"].includes(value) && (
              <span>
                {value === "upcoming"
                  ? upcomingCount
                  : value === "past"
                    ? pastCount
                    : savedCount}
              </span>
            )}
          </Link>
        ))}
      </nav>
      {(tab === "upcoming" || tab === "past") && (
        <>
          <section
            className="plans-section"
            aria-labelledby="plans-ticket-title"
          >
            <div className="plans-section-heading">
              <h2 id="plans-ticket-title">
                {tab === "past" ? "Your past plans" : "Coming up"}
              </h2>
              <Link href={`/my-tickets${tab === "past" ? "?tab=past" : ""}`}>
                All tickets <ArrowRight size={16} />
              </Link>
            </div>
            {grouped.size ? (
              <div className="plans-ticket-list">
                {Array.from(grouped.values()).map((group) => {
                  const ticket = group[0],
                    event = ticket.event;
                  const partiallyRefunded =
                    ticket.order.status === "PARTIALLY_REFUNDED";
                  const today =
                    date(event.startsAt, event.timezone, {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }) ===
                    date(now, event.timezone, {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    });
                  const days = Math.max(
                    1,
                    Math.ceil(
                      (event.startsAt.getTime() - now.getTime()) / 86400000,
                    ),
                  );
                  const directions =
                    event.mode !== "ONLINE" &&
                    (event.venueName || event.city || event.lat !== null)
                      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.lat !== null && event.lng !== null ? `${event.lat},${event.lng}` : [event.venueName, event.address, event.city].filter(Boolean).join(", "))}`
                      : null;
                  return (
                    <article
                      className="plans-ticket"
                      key={`${ticket.orderId}:${ticket.ticketTypeId}`}
                    >
                      <Link
                        href={`/e/${event.slug}`}
                        className="plans-ticket-poster"
                        aria-label={`View ${event.title}`}
                      >
                        <EventImage
                          variants={
                            event.images.find(
                              (image) => image.kind === "POSTER",
                            )?.variants || event.images[0]?.variants
                          }
                          alt={event.title}
                          size="thumb"
                          className="plans-poster-image"
                        />
                      </Link>
                      <div className="plans-ticket-body">
                        <div className="plans-ticket-meta">
                          <span className="plans-date-chip">
                            {date(event.startsAt, event.timezone, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span
                            className="plans-status"
                            data-status={
                              partiallyRefunded
                                ? ticket.order.status
                                : ticket.status
                            }
                          >
                            {partiallyRefunded
                              ? "Partially refunded"
                              : tab === "past"
                                ? ticket.status === "USED"
                                  ? "Attended"
                                  : "Event ended"
                                : today
                                  ? "Today"
                                  : event.startsAt <= now
                                    ? "Happening now"
                                    : `In ${days} ${days === 1 ? "day" : "days"}`}
                          </span>
                        </div>
                        <h3>
                          <Link href={`/e/${event.slug}`}>{event.title}</Link>
                        </h3>
                        <p>
                          <CalendarDays size={15} aria-hidden="true" />
                          {date(event.startsAt, event.timezone, {
                            weekday: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          ·{" "}
                          {event.timezone === "Asia/Kolkata"
                            ? "IST"
                            : event.timezone}
                        </p>
                        <p>
                          <MapPin size={15} aria-hidden="true" />
                          {event.mode === "ONLINE"
                            ? "Online event"
                            : [event.venueName, event.city]
                                .filter(Boolean)
                                .join(" · ") || "Venue to be announced"}
                        </p>
                        <small>
                          {Array.from(
                            new Set(group.map((item) => item.ticketType.name)),
                          ).join(" + ")}{" "}
                          ·{" "}
                          {group.length < ticket.order._count.tickets
                            ? `${group.length} of ${ticket.order._count.tickets} tickets shown`
                            : `${group.length} ${group.length === 1 ? "ticket" : "tickets"}`}
                        </small>
                        <small>
                          Hosted by{" "}
                          <Link href={`/organizers/${event.org.slug}`}>
                            {event.org.name}
                          </Link>
                        </small>
                        <div className="plans-ticket-links">
                          {directions && (
                            <a
                              href={directions}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Directions
                            </a>
                          )}
                          <a href={`/api/events/${event.id}/calendar`}>
                            Add to calendar
                          </a>
                          {event.visibility === "PUBLIC" &&
                            event.status === "PUBLISHED" &&
                            !event.deletedAt && (
                              <a
                                href={whatsappEventUrl(
                                  event.title,
                                  `${process.env.APP_URL}/e/${event.slug}`,
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Share event
                              </a>
                            )}
                        </div>
                      </div>
                      <div className="plans-ticket-entry">
                        <Ticket size={24} aria-hidden="true" />
                        <Link
                          className={`plans-button${tab === "upcoming" && !partiallyRefunded ? " plans-primary" : ""}`}
                          href={
                            partiallyRefunded
                              ? `/orders/${ticket.orderId}`
                              : `/my-tickets/${ticket.id}`
                          }
                        >
                          {partiallyRefunded
                            ? "View booking"
                            : tab === "upcoming"
                              ? "Show ticket"
                              : "View ticket"}
                          <ArrowRight size={16} />
                        </Link>
                        <span>{ticket.code}</span>
                        {ticket.order._count.tickets > 1 && (
                          <Link href={`/orders/${ticket.orderId}`}>
                            See all tickets
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="plans-empty">
                <span className="plans-empty-icon">
                  <Ticket size={30} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <div>
                  <h3>
                    {tab === "past"
                      ? "Good memories will live here."
                      : "Your next good memory starts here."}
                  </h3>
                  <p>
                    {tab === "past"
                      ? "Events you’ve attended and tickets from ended events appear in Past."
                      : "No upcoming tickets yet. Find something worth showing up for."}
                  </p>
                  <div className="plans-empty-actions">
                    <Link
                      href="/discover"
                      className="plans-button plans-primary"
                    >
                      Explore events <ArrowRight size={16} />
                    </Link>
                    <Link href="/my-tickets/recover" className="plans-button">
                      Find a booking
                    </Link>
                  </div>
                </div>
              </div>
            )}
            {tab === "upcoming" &&
              (cancelledCount > 0 || refundedCount > 0) && (
                <p className="plans-note">
                  Booking updates:{" "}
                  {cancelledCount > 0 && (
                    <Link href="/my-tickets?tab=cancelled">
                      {cancelledCount} cancelled{" "}
                      {cancelledCount === 1 ? "ticket" : "tickets"}
                    </Link>
                  )}
                  {cancelledCount > 0 && refundedCount > 0 && " · "}
                  {refundedCount > 0 && (
                    <Link href="/my-tickets?tab=refunded">
                      {refundedCount} refunded{" "}
                      {refundedCount === 1 ? "ticket" : "tickets"}
                    </Link>
                  )}
                </p>
              )}
          </section>
          {tab === "upcoming" && (
            <div className="plans-secondary-grid">
              <div>
                {renderSaved()}
                {renderOrders()}
              </div>
              <aside className="plans-aside">
                <SlidersHorizontal size={21} aria-hidden="true" />
                <h2>Make it yours.</h2>
                <p>
                  Keep your name, phone and city up to date so your next booking
                  feels easy.
                </p>
                <Link href="/account?tab=settings">
                  Account settings <ArrowRight size={16} />
                </Link>
                {memberships.length > 0 && (
                  <div className="plans-hosting">
                    <BriefcaseBusiness size={21} aria-hidden="true" />
                    <h2>Hosting</h2>
                    {memberships.map(({ org }) => (
                      <Link
                        key={org.id}
                        href={`/dashboard/events?org=${org.id}`}
                      >
                        <span>
                          <strong>{org.name}</strong>
                          <small>
                            {org._count.events}{" "}
                            {org._count.events === 1 ? "event" : "events"}
                          </small>
                        </span>
                        <ArrowRight size={17} />
                      </Link>
                    ))}
                  </div>
                )}
              </aside>
            </div>
          )}
        </>
      )}
      {tab === "saved" && renderSaved()}
      {tab === "orders" && (
        <>
          {renderOrders()}
          {orderCount > 12 && (
            <nav className="plans-orders-pages" aria-label="Order pages">
              {page > 1 && (
                <Link href={`/account?tab=orders&page=${page - 1}`}>
                  ← Previous
                </Link>
              )}
              <span>
                {orderCount} orders · page {page}
              </span>
              {page * 12 < orderCount && (
                <Link href={`/account?tab=orders&page=${page + 1}`}>
                  Next →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
      {tab === "settings" && (
        <section className="plans-section plans-settings">
          <div className="plans-section-heading">
            <h2>Your account</h2>
          </div>
          <article>
            <div>
              <h3>Profile & contact details</h3>
              <p>{user.email}</p>
              <p>
                {user.phone || "Add a phone number to make booking easier."}
              </p>
            </div>
            <Link className="plans-button" href="/account/profile">
              Edit profile <ArrowRight size={16} />
            </Link>
          </article>
          <article>
            <div>
              <h3>Ticket delivery</h3>
              <p>
                Booking confirmations and tickets go to your booking email.
                WhatsApp delivery is chosen at checkout for each booking.
              </p>
            </div>
            <Link href="/account?tab=orders">
              View booking delivery <ArrowRight size={16} />
            </Link>
          </article>
          <article>
            <div>
              <h3>Need a hand?</h3>
              <p>Recover a missing booking or ask us about your account.</p>
            </div>
            <Link href="/my-tickets/recover">
              Find a booking <ArrowRight size={16} />
            </Link>
            <Link href="/contact">
              Contact support <ArrowRight size={16} />
            </Link>
          </article>
        </section>
      )}
      {tab === "upcoming" && (
        <section className="plans-section plans-discovery">
          <div className="plans-section-heading">
            <div>
              <p className="m-eyebrow">A LITTLE ROOM FOR SOMETHING NEW</p>
              <h2>
                {nearby?.total && hub
                  ? `Around ${hub.city}`
                  : "Worth stepping out for"}
              </h2>
              <p className="plans-note">
                {hub
                  ? `${hub.city} · 50 km${!nearby?.total && suggestions.length ? " — showing events across all cities for now" : ""}`
                  : "Upcoming events across all cities"}
              </p>
            </div>
            <AccountCity initial={hub?.city || "all"} />
          </div>
          {suggestions.length === 1 ? (
            (() => {
              const single = suggestions[0];
              const singleImage =
                single.images.find((v) => v.kind === "COVER" && v.variants) ||
                single.images.find((v) => v.kind === "POSTER" && v.variants) ||
                single.images.find((v) => v.variants);
              const minimum = single.ticketTypes.length
                ? Math.min(...single.ticketTypes.map((v) => v.pricePaise))
                : null;
              const formattedDate = new Intl.DateTimeFormat("en-IN", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: single.timezone,
              }).format(single.startsAt);
              const isSaved = savedSuggestions.some(
                (item) => item.eventId === single.id,
              );
              return (
                <div className="plans-spotlight-wrapper">
                  <article className="plans-spotlight-card">
                    <div className="plans-spotlight-media">
                      <Link
                        href={`/e/${single.slug}`}
                        tabIndex={-1}
                        aria-hidden="true"
                      >
                        <EventImage
                          variants={singleImage?.variants}
                          alt={singleImage?.alt || single.title}
                          size="card"
                          className="plans-spotlight-cover"
                        />
                      </Link>
                      <div className="plans-spotlight-badge-row">
                        <span className="plans-badge plans-badge-category">
                          {single.category || "Get together"}
                        </span>
                        {single.mode === "ONLINE" && (
                          <span className="plans-badge plans-badge-mode">
                            Online
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="plans-spotlight-content">
                      <div className="plans-spotlight-header">
                        <div className="plans-spotlight-eyebrow">
                          <span
                            className="plans-pulse-dot"
                            aria-hidden="true"
                          />
                          <span>FEATURED SPOTLIGHT</span>
                        </div>
                        <h3 className="plans-spotlight-title">
                          <Link href={`/e/${single.slug}`}>{single.title}</Link>
                        </h3>
                        {single.reviewSummary &&
                          single.reviewSummary.count > 0 &&
                          single.reviewSummary.average !== null && (
                            <p
                              className="plans-spotlight-rating"
                              aria-label={`${single.reviewSummary.average.toFixed(1)} out of 5 from ${single.reviewSummary.count} reviews`}
                            >
                              <Star
                                size={14}
                                fill="currentColor"
                                aria-hidden="true"
                              />
                              <strong>
                                {single.reviewSummary.average.toFixed(1)}
                              </strong>
                              <span>
                                ({single.reviewSummary.count} verified reviews)
                              </span>
                            </p>
                          )}
                        <p className="plans-spotlight-synopsis">
                          {single.summary ||
                            single.description?.slice(0, 160) ||
                            "Join this handpicked gathering curated for great people and memorable conversations."}
                        </p>
                      </div>

                      <div className="plans-spotlight-meta-grid">
                        <div className="plans-meta-chip">
                          <CalendarDays size={16} aria-hidden="true" />
                          <div>
                            <span className="plans-meta-label">When</span>
                            <strong>{formattedDate}</strong>
                          </div>
                        </div>
                        <div className="plans-meta-chip">
                          <MapPin size={16} aria-hidden="true" />
                          <div>
                            <span className="plans-meta-label">Where</span>
                            <strong>
                              {single.mode === "ONLINE"
                                ? "Live online stream"
                                : [single.venueName, single.city]
                                    .filter(Boolean)
                                    .join(" · ") || "Venue to be announced"}
                            </strong>
                          </div>
                        </div>
                        <div className="plans-meta-chip">
                          <Ticket size={16} aria-hidden="true" />
                          <div>
                            <span className="plans-meta-label">Admission</span>
                            <strong>
                              {minimum === null
                                ? "Tickets soon"
                                : minimum === 0
                                  ? "Free entrance"
                                  : `From ${new Intl.NumberFormat("en-IN", {
                                      style: "currency",
                                      currency: "INR",
                                      maximumFractionDigits: 0,
                                    }).format(Math.round(minimum / 100))}`}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="plans-spotlight-actions">
                        <Link
                          href={`/e/${single.slug}`}
                          className="m-button plans-spotlight-btn"
                        >
                          Book tickets{" "}
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        <div className="plans-spotlight-subactions">
                          <Link
                            href={`/organizers/${single.org.slug}`}
                            className="plans-spotlight-org"
                          >
                            by <strong>{single.org.name}</strong>
                          </Link>
                          <div className="plans-spotlight-action-icons">
                            <SaveEvent
                              eventId={single.id}
                              initial={isSaved}
                              labeled
                            />
                            <a
                              href={whatsappEventUrl(
                                single.title,
                                `${process.env.APP_URL}/e/${single.slug}`,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="plans-spotlight-share"
                              aria-label={`Share ${single.title} on WhatsApp`}
                            >
                              Share ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="plans-host-card">
                    <div className="plans-host-badge">
                      <span>FIRST EVENT IS FREE TO HOST</span>
                    </div>
                    <div className="plans-host-body">
                      <h3>Have an idea worth gathering for?</h3>
                      <p>
                        Host intimate dinners, rooftop sessions, workshops, live
                        comedy or community meetups. Raunak gives you tickets,
                        instant UPI payouts, and verified attendee lists.
                      </p>
                      <ul className="plans-host-features">
                        <li>
                          <span className="plans-host-check" aria-hidden="true">
                            ✓
                          </span>
                          <span>Zero upfront cost — publish in 3 minutes</span>
                        </li>
                        <li>
                          <span className="plans-host-check" aria-hidden="true">
                            ✓
                          </span>
                          <span>Direct UPI & WhatsApp ticket delivery</span>
                        </li>
                        <li>
                          <span className="plans-host-check" aria-hidden="true">
                            ✓
                          </span>
                          <span>Built-in discovery across your city</span>
                        </li>
                      </ul>
                    </div>
                    <div className="plans-host-footer">
                      <Link
                        href={
                          memberships.length ? "/dashboard" : "/organizer/setup"
                        }
                        className="plans-host-cta"
                      >
                        <span>
                          {memberships.length
                            ? "Open host dashboard"
                            : "Host your first event — free"}
                        </span>
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                      <span className="plans-host-note">
                        No credit card required · Instant onboarding
                      </span>
                    </div>
                  </article>
                </div>
              );
            })()
          ) : suggestions.length > 1 ? (
            <ul className="plans-discover-grid">
              {suggestions.map((event) => (
                <EventCard
                  event={event}
                  key={event.id}
                  saved={savedSuggestions.some(
                    (item) => item.eventId === event.id,
                  )}
                />
              ))}
            </ul>
          ) : null}
          {suggestions.length > 0 && (
            <Link
              className="plans-discovery-link"
              href={discoveryUrl(nearby?.total ? discoveryInput : {})}
            >
              Explore more events <ArrowRight size={16} />
            </Link>
          )}
          {!suggestions.length && (
            <div className="plans-empty-inline">
              <div>
                <h3>Good plans are on their way.</h3>
                <p>
                  No upcoming public events are available right now. Have an
                  idea worth getting together for?
                </p>
              </div>
              <Link
                href={memberships.length ? "/dashboard" : "/organizer/setup"}
                className="plans-button"
              >
                {memberships.length ? "Your events" : "Host an event"}
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
          <div className="plans-browse">
            <Link href={discoveryUrl({ period: "weekend" })}>
              This weekend <ArrowRight size={15} />
            </Link>
            <Link href={discoveryUrl({ price: "free" })}>
              Free events <ArrowRight size={15} />
            </Link>
            <Link href={discoveryUrl({ mode: "ONLINE" })}>
              Online events <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
