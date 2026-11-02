import { publicEvent } from "@/server/public/events";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { variantUrl } from "@/lib/images";
import { organizerLogoUrl } from "@/lib/organizer-images";
import { eventCalendarOptions } from "@/lib/event-calendar";
import { ticketAvailability } from "@/lib/ticket-availability";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!slug || slug.length > 150)
      return Response.json(
        { error: "Event not found." },
        { status: 404, headers },
      );
    const event = await publicEvent(slug);
    if (!event)
      return Response.json(
        { error: "Event not found." },
        { status: 404, headers },
      );
    const base = process.env.APP_URL || new URL(request.url).origin;
    const absolute = (path: string | null) =>
      path ? new URL(path, base).href : null;
    const publicUrl = new URL(`/e/${event.slug}`, base).href;
    const user = await currentUser();
    const saved = user
      ? Boolean(
          await db.savedEvent.findUnique({
            where: { userId_eventId: { userId: user.id, eventId: event.id } },
            select: { eventId: true },
          }),
        )
      : false;
    const calendar = eventCalendarOptions(event, publicUrl);
    const location =
      event.lat != null && event.lng != null
        ? `${Number(event.lat)},${Number(event.lng)}`
        : [event.venueName, event.address, event.city]
            .filter(Boolean)
            .join(", ");
    const imageUrl = (variants: unknown, size: string) =>
      absolute(
        variantUrl(variants, size, "webp") || variantUrl(variants, size),
      );
    const images = [
      ...event.images.filter((image) => image.kind === "POSTER"),
      ...event.images.filter((image) => image.kind === "COVER"),
      ...event.images.filter((image) => image.kind === "GALLERY"),
    ].flatMap((image) => {
      const url = imageUrl(image.variants, "hero");
      return url ? [{ url, alt: image.alt || event.title }] : [];
    });
    return Response.json(
      {
        id: event.id,
        slug: event.slug,
        title: event.title,
        summary: event.summary,
        description: event.description,
        status: event.status,
        mode: event.mode,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        timezone: event.timezone,
        dateLabel: new Intl.DateTimeFormat("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: event.timezone,
        }).format(event.startsAt),
        timeLabel: new Intl.DateTimeFormat("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: event.timezone,
          timeZoneName: "short",
        }).format(event.startsAt),
        venueName: event.venueName,
        address: event.address,
        city: event.city,
        images,
        organizerName: event.org.name,
        organizerTagline: event.org.tagline,
        organizerImageUrl: absolute(
          organizerLogoUrl(event.org.id, event.org.logoKey),
        ),
        organizerUrl: new URL(`/organizers/${event.org.slug}`, base).href,
        people: event.people
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
          .map((person) => ({
            name: person.name,
            role: person.title,
            bio: person.bio,
            imageUrl: imageUrl(
              event.images.find((image) => image.storageKey === person.photoKey)
                ?.variants,
              "thumb",
            ),
          })),
        publicUrl,
        saved,
        refundPolicy: event.refundPolicy,
        calendarGoogleUrl: calendar?.google || null,
        calendarOutlookUrl: calendar?.outlook || null,
        calendarIcsUrl: calendar
          ? new URL(`/api/events/${event.id}/calendar`, base).href
          : null,
        directionsGoogleUrl:
          event.mode !== "ONLINE" && location
            ? `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: location })}`
            : null,
        directionsAppleUrl:
          event.mode !== "ONLINE" && location
            ? `https://maps.apple.com/?${new URLSearchParams({ daddr: location })}`
            : null,
        tickets: event.ticketTypes
          .filter((ticket) => !ticket.isHidden)
          .map((ticket) => {
            const availability = ticketAvailability(
              ticket,
              event.startsAt,
              event.timezone,
              Date.now(),
              event.status,
            );
            return {
              id: ticket.id,
              name: ticket.name,
              description: ticket.description,
              pricePaise: ticket.pricePaise,
              minPerOrder: ticket.minPerOrder,
              maxPerOrder: ticket.maxPerOrder,
              available: availability.available,
              remaining: availability.remaining,
              label: availability.label,
            };
          }),
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Event details could not be loaded. Please try again." },
      { status: 503, headers },
    );
  }
}
