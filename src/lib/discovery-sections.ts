import { discoveryDates } from "@/lib/discovery-dates";
type Listing = {
  id: string;
  city: string | null;
  category: string | null;
  startsAt: Date;
  createdAt: Date;
  ticketTypes: { pricePaise: number }[];
};
export function discoverySections<T extends Listing>(
  events: T[],
  city?: string | null,
  now = new Date(),
) {
  if (events.length < 8)
    return {
      primary: events,
      sections: [] as { title: string; href: string; events: T[] }[],
    };
  const primary = events.slice(0, 4),
    remaining = new Set(events.slice(4).map((event) => event.id));
  const sections: { title: string; href: string; events: T[] }[] = [];
  const weekend = discoveryDates("weekend", undefined, now);
  const groups: [string, string, (event: T) => boolean][] = [
    [
      "Happening this weekend",
      "/discover?period=weekend",
      (event) => event.startsAt >= weekend.gte && event.startsAt < weekend.lt!,
    ],
    ...(city
      ? [
          [
            `Around ${city}`,
            `/discover?city=${encodeURIComponent(city)}`,
            (event: T) => event.city?.toLowerCase() === city.toLowerCase(),
          ] as [string, string, (event: T) => boolean],
        ]
      : []),
    [
      "Good plans, free entry",
      "/discover?price=free",
      (event) => event.ticketTypes.some((type) => type.pricePaise === 0),
    ],
    [
      "Workshops & classes",
      `/discover?category=${encodeURIComponent("Workshops & classes")}`,
      (event) => event.category === "Workshops & classes",
    ],
    [
      "Music & nightlife",
      `/discover?category=${encodeURIComponent("Music & nightlife")}`,
      (event) => event.category === "Music & nightlife",
    ],
    [
      "Recently added",
      "/discover?sort=newest",
      (event) => event.createdAt.getTime() >= now.getTime() - 7 * 86400000,
    ],
  ];
  for (const [title, href, match] of groups) {
    const matches = events
      .filter((event) => remaining.has(event.id) && match(event))
      .slice(0, 4);
    if (matches.length < 2) continue;
    sections.push({ title, href, events: matches });
    for (const event of matches) remaining.delete(event.id);
    if (sections.length === 2) break;
  }
  return {
    primary: [...primary, ...events.filter((event) => remaining.has(event.id))],
    sections,
  };
}
