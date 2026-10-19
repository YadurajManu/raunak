import { db } from "@/server/db/client";
import { publicListing } from "@/server/public/events";
import { citySuggestions } from "@/config/cities";
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 2 || q.length > 100) return Response.json({ suggestions: [] });
  try {
    const events = await db.event.findMany({
      where: {
        ...publicListing,
        startsAt: { gt: new Date() },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { venueName: { contains: q, mode: "insensitive" } },
          {
            org: {
              name: { contains: q, mode: "insensitive" },
              status: "ACTIVE",
            },
          },
        ],
      },
      select: {
        title: true,
        slug: true,
        venueName: true,
        org: { select: { name: true, slug: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 8,
    });
    const needle = q.toLocaleLowerCase("en-IN");
    const suggestions = [
      ...events.filter((event) => event.title.toLocaleLowerCase("en-IN").includes(needle)).slice(0, 3).map((event) => ({ label: event.title, kind: "Event", href: `/e/${event.slug}` })),
      ...events.filter((event) => event.venueName?.toLocaleLowerCase("en-IN").includes(needle)).slice(0, 2).map((event) => ({ label: event.venueName!, kind: "Venue", href: `/discover?q=${encodeURIComponent(event.venueName!)}` })),
      ...events.filter((event) => event.org.name.toLocaleLowerCase("en-IN").includes(needle)).slice(0, 2).map((event) => ({ label: event.org.name, kind: "Organizer", href: `/organizers/${event.org.slug}` })),
      ...citySuggestions(q).slice(0, 3).map((place) => ({
        label: place.city,
        kind: "City",
        href: `/discover?city=${encodeURIComponent(place.city)}`,
      })),
    ];
    return Response.json(
      {
        suggestions: suggestions
          .filter(
            (v, i) =>
              suggestions.findIndex((other) => other.href === v.href) === i,
          )
          .slice(0, 8),
      },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  } catch {
    return Response.json(
      { error: "Suggestions unavailable. You can still search." },
      { status: 503 },
    );
  }
}
