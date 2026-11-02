import { z } from "zod";
import { discoverPage } from "@/server/public/events";
import { eventCategories } from "@/config/event-options";
import { variantUrl } from "@/lib/images";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await discoverPage(Object.fromEntries(url.searchParams));
    const base = process.env.APP_URL || url.origin;
    return Response.json(
      {
        events: result.events.map((event) => {
          const poster =
            event.images.find((image) => image.kind === "POSTER") ||
            event.images.find((image) => image.kind === "COVER");
          const image =
            variantUrl(poster?.variants, "card", "webp") ||
            variantUrl(poster?.variants, "card");
          const prices = event.ticketTypes.map((ticket) => ticket.pricePaise);
          return {
            id: event.id,
            slug: event.slug,
            title: event.title,
            summary: event.summary,
            category: event.category,
            city: event.city,
            mode: event.mode,
            imageUrl: image ? new URL(image, base).href : null,
            dateLabel: new Intl.DateTimeFormat("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
              timeZone: event.timezone,
            }).format(event.startsAt),
            venueLabel:
              event.mode === "ONLINE"
                ? "Online event"
                : [event.venueName, event.city].filter(Boolean).join(" · ") ||
                  "Venue details on event page",
            organizerName: event.org.name,
            pricePaise: prices.length ? Math.min(...prices) : null,
            publicUrl: new URL(`/e/${event.slug}`, base).href,
          };
        }),
        total: result.total,
        page: result.filters.page,
        hasMore: result.filters.page * 12 < result.total,
        categories: eventCategories,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=15",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Check your search filters and try again."
            : "Events could not be loaded. Please try again.",
      },
      {
        status: error instanceof z.ZodError ? 400 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
