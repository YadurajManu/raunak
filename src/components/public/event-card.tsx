import Link from "next/link";
import { EventImage } from "./event-image";
import { SaveEvent } from "./save-event";
import { whatsappEventUrl } from "@/lib/event-share";
import { CalendarDays, MapPin, Star } from "lucide-react";
export function EventCard({
  event,
  saved = false,
}: {
  event: {
    id: string;
    slug: string;
    title: string;
    timezone: string;
    startsAt: Date;
    city: string | null;
    venueName: string | null;
    category: string | null;
    mode: string;
    org: { name: string; slug: string };
    images: { kind: string; variants: unknown; alt: string }[];
    ticketTypes: { pricePaise: number }[];
    reviewSummary?: { average: number | null; count: number } | null;
  };
  saved?: boolean;
}) {
  const image =
    event.images.find((v) => v.kind === "COVER" && v.variants) ||
    event.images.find((v) => v.kind === "POSTER" && v.variants) ||
    event.images.find((v) => v.variants);
  const minimum = event.ticketTypes.length
    ? Math.min(...event.ticketTypes.map((v) => v.pricePaise))
    : null;
  return (
    <li className="market-card">
      <Link href={`/e/${event.slug}`} className="market-main">
        <EventImage
          variants={image?.variants}
          alt={image?.alt || event.title}
          size="card"
          className="market-cover"
        />
        <div>
          <span className="m-eyebrow">{event.category || "Get together"}</span>
          <h3>{event.title}</h3>
          {event.reviewSummary && event.reviewSummary.count > 0 && event.reviewSummary.average !== null && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm" aria-label={`${event.reviewSummary.average.toFixed(1)} out of 5 from ${event.reviewSummary.count} verified attendee reviews`}>
              <Star size={14} fill="currentColor" className="text-[var(--accent)]" aria-hidden="true" />
              <strong>{event.reviewSummary.average.toFixed(1)}</strong>
              <span className="text-[var(--muted)]">· {event.reviewSummary.count} verified</span>
            </p>
          )}
          <time dateTime={event.startsAt.toISOString()}>
            <CalendarDays size={14} aria-hidden="true" />
            {new Intl.DateTimeFormat("en-IN", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: event.timezone,
            }).format(event.startsAt)}
          </time>
          <p>
            <MapPin size={14} aria-hidden="true" />
            {event.mode === "ONLINE"
              ? "Online"
              : [event.venueName, event.city].filter(Boolean).join(" · ") ||
                "Venue to be announced"}
          </p>
          <strong>
            {minimum === null
              ? "Tickets soon"
              : minimum === 0
                ? "Free"
                : `From ${new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(Math.round(minimum / 100))}`}
          </strong>
        </div>
      </Link>
      <footer>
        <Link href={`/organizers/${event.org.slug}`}>{event.org.name}</Link>
        <SaveEvent eventId={event.id} initial={saved} />
        <a
          href={whatsappEventUrl(
            event.title,
            `${process.env.APP_URL}/e/${event.slug}`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share ${event.title} on WhatsApp`}
        >
          Share ↗
        </a>
      </footer>
    </li>
  );
}
