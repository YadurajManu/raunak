import Link from "next/link";
import { EventImage } from "./event-image";
import { SaveEvent } from "./save-event";
import { whatsappEventUrl } from "@/lib/event-share";
import { formatInr } from "@/lib/money";
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
  };
  saved?: boolean;
}) {
  const image =
    event.images.find((v) => v.kind === "POSTER") || event.images[0];
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
          <time dateTime={event.startsAt.toISOString()}>
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
                : `From ${formatInr(minimum)}`}
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
