import { z } from "zod";
import { cache } from "react";
import { db } from "@/server/db/client";
import { Prisma } from "@/generated/prisma/client";
import { discoverySchema } from "@/lib/discovery";
import { Temporal } from "@js-temporal/polyfill";
import { discoveryDates } from "@/lib/discovery-dates";

export const publicEvent = cache(async function publicEvent(slug: string) {
  const parsed = z.string().min(1).max(150).parse(slug);
  return db.event.findFirst({
    where: {
      slug: parsed,
      status: { in: ["PUBLISHED", "ENDED"] },
      deletedAt: null,
      isTest: false,
      org: { status: "ACTIVE" },
    },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          supportEmail: true,
          supportPhone: true,
          brandColor: true,
          platformFeeBps: true,
          platformFeeFixedPaise: true,
          feeMode: true,
          logoKey: true,
          coverKey: true,
          coverPosition: true,
          tagline: true,
          bio: true,
        },
      },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      people: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      ticketTypes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
});

export const publicListing = {
  status: "PUBLISHED" as const,
  visibility: "PUBLIC" as const,
  deletedAt: null,
  isTest: false,
  org: { status: "ACTIVE" as const },
};
export async function discoverPage(input: unknown) {
  const f = discoverySchema.parse(input);
  const dates = discoveryDates(f.period, f.from || undefined);
  const from = new Date(Math.max(Date.now(), dates.gte.getTime()));
  const to =
    f.to && !f.period
      ? new Date(
          Temporal.PlainDate.from(f.to)
            .add({ days: 1 })
            .toZonedDateTime({ timeZone: "Asia/Kolkata", plainTime: "00:00" })
            .epochMilliseconds,
        )
      : dates.lt;
  const categories = f.category.split("|").filter(Boolean).slice(0, 12);
  const clauses: Prisma.Sql[] = [
    Prisma.sql`e.status = 'PUBLISHED' AND e.visibility = 'PUBLIC' AND e."deletedAt" IS NULL AND e."isTest" = false AND o.status = 'ACTIVE' AND e."startsAt" >= ${from}`,
  ];
  if (to) clauses.push(Prisma.sql`e."startsAt" < ${to}`);
  if (f.q)
    clauses.push(
      Prisma.sql`(position(lower(${f.q}) in lower(e.title)) > 0 OR position(lower(${f.q}) in lower(coalesce(e.summary,''))) > 0 OR position(lower(${f.q}) in lower(coalesce(e."venueName",''))) > 0 OR position(lower(${f.q}) in lower(o.name)) > 0)`,
    );
  if (f.city) clauses.push(Prisma.sql`lower(e.city) = lower(${f.city})`);
  if (f.organizer) clauses.push(Prisma.sql`o.slug = ${f.organizer}`);
  if (categories.length)
    clauses.push(
      Prisma.sql`lower(e.category) IN (${Prisma.join(categories.map((c) => c.toLowerCase()))})`,
    );
  if (f.mode) clauses.push(Prisma.sql`e.mode::text = ${f.mode}`);
  if (f.price === "free") clauses.push(Prisma.sql`p.price = 0`);
  if (f.price === "paid") clauses.push(Prisma.sql`p.price > 0`);
  if (f.min !== undefined)
    clauses.push(Prisma.sql`p.price >= ${Math.round(f.min * 100)}`);
  if (f.max !== undefined)
    clauses.push(Prisma.sql`p.price <= ${Math.round(f.max * 100)}`);
  if (f.lat !== undefined && f.lng !== undefined)
    clauses.push(
      Prisma.sql`e.lat IS NOT NULL AND e.lng IS NOT NULL AND e.mode != 'ONLINE' AND 6371 * 2 * asin(sqrt(LEAST(1, power(sin(radians(e.lat::float8 - ${f.lat}) / 2), 2) + cos(radians(${f.lat}::float8)) * cos(radians(e.lat::float8)) * power(sin(radians(e.lng::float8 - ${f.lng}) / 2), 2)))) <= ${f.radius}`,
    );
  const source = Prisma.sql`FROM "Event" e JOIN "Organization" o ON o.id = e."orgId" LEFT JOIN LATERAL (SELECT MIN("pricePaise") AS price FROM "TicketType" WHERE "eventId" = e.id AND "isHidden" = false) p ON true WHERE ${Prisma.join(clauses, " AND ")}`;
  const order =
    f.sort === "newest"
      ? Prisma.sql`e."createdAt" DESC`
      : f.sort === "price"
        ? Prisma.sql`p.price ASC NULLS LAST`
        : f.sort === "price-desc"
          ? Prisma.sql`p.price DESC NULLS LAST`
          : Prisma.sql`e."startsAt" ASC`;
  const [ids, count] = await Promise.all([
    db.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT e.id ${source} ORDER BY ${order}, e.id ASC LIMIT 12 OFFSET ${(f.page - 1) * 12}`,
    ),
    db.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`SELECT count(*) AS total ${source}`,
    ),
  ]);
  const [events, reviewSummaries] = await Promise.all([
    db.event.findMany({
      where: { ...publicListing, id: { in: ids.map((v) => v.id) } },
      include: {
        org: { select: { id: true, name: true, slug: true, logoKey: true } },
        images: {
          where: { kind: { in: ["POSTER", "COVER"] } },
          orderBy: { kind: "desc" },
          take: 2,
        },
        ticketTypes: { where: { isHidden: false }, select: { pricePaise: true } },
      },
    }),
    ids.length
      ? db.eventReview.groupBy({
          by: ["eventId"],
          where: { eventId: { in: ids.map((value) => value.id) } },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);
  const reviewsByEvent = new Map(
    reviewSummaries.map((summary) => [summary.eventId, summary]),
  );
  return {
    events: ids.flatMap((v) => {
      const event = events.find((e) => e.id === v.id);
      if (!event) return [];
      const summary = reviewsByEvent.get(event.id);
      return [
        {
          ...event,
          reviewSummary: summary
            ? { average: summary._avg.rating, count: summary._count._all }
            : null,
        },
      ];
    }),
    total: Number(count[0].total),
    filters: f,
  };
}
export async function discoverEvents(input: unknown) {
  return (await discoverPage(input)).events;
}
