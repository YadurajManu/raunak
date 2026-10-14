import { z } from "zod";
import { db } from "@/server/db/client";
import { discoveryDates, dateChoices } from "@/lib/discovery-dates";

export async function publicEvent(slug: string) {
  const parsed = z.string().min(1).max(150).parse(slug);
  return db.event.findFirst({
    where: { slug: parsed, status: "PUBLISHED", deletedAt: null },
    include: {
      org: {
        select: {
          name: true,
          supportEmail: true,
          supportPhone: true,
          brandColor: true,
          platformFeeBps: true,
          platformFeeFixedPaise: true,
          feeMode: true,
        },
      },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      people: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      ticketTypes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
}

export async function discoverEvents(input: unknown) {
  const filters = z
    .object({
      q: z.string().trim().max(100).optional(),
      city: z.string().trim().max(100).optional(),
      category: z.string().trim().max(80).optional(),
      from: z.iso.date().optional(),
      period: z.enum(dateChoices).optional(),
    })
    .parse(input);
  return db.event.findMany({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      deletedAt: null,
      startsAt: discoveryDates(filters.period, filters.from),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { summary: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filters.city
        ? { city: { equals: filters.city, mode: "insensitive" } }
        : {}),
      ...(filters.category
        ? { category: { equals: filters.category, mode: "insensitive" } }
        : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 100,
    include: {
      images: { where: { kind: "POSTER" }, take: 1 },
      ticketTypes: { where: { isHidden: false }, select: { pricePaise: true } },
    },
  });
}
