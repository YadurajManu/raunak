export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { db } from "@/server/db/client";
import { publicListing } from "@/server/public/events";
import { docsPages } from "@/lib/docs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://raunak.yaduraj.me";
  // Keep the static sitemap available during a transient database outage.
  const events = await db.event.findMany({
    where: publicListing,
    select: { slug: true, city: true, startsAt: true, updatedAt: true, org: { select: { slug: true, profileVisible: true } } },
  }).catch(() => []);
  const cities = new Map<string, Date>();
  const organizers = new Map<string, Date>();
  for (const event of events) if (event.city && event.startsAt >= new Date()) {
    const last = cities.get(event.city);
    if (!last || event.updatedAt > last) cities.set(event.city, event.updatedAt);
  }
  for (const event of events) if (event.org.profileVisible) {
    const last = organizers.get(event.org.slug);
    if (!last || event.updatedAt > last) organizers.set(event.org.slug, event.updatedAt);
  }
  return [
    { url: base, changeFrequency: "weekly" },
    ...["privacy", "terms", "contact", "help", "refunds", "about", "how-it-works", "brand"].map((path) => ({
      url: `${base}/${path}`,
      changeFrequency: "monthly" as const,
    })),
    { url: `${base}/discover`, changeFrequency: "daily" },
    { url: `${base}/docs`, changeFrequency: "monthly" },
    ...docsPages.map((page) => ({
      url: `${base}/docs/${page.slug}`,
      changeFrequency: "monthly" as const,
    })),
    ...events.map((event) => ({
      url: `${base}/e/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: "daily" as const,
    })),
    ...[...cities].map(([city, lastModified]) => ({ url: `${base}/cities/${encodeURIComponent(city)}`, lastModified, changeFrequency: "daily" as const })),
    ...[...organizers].map(([slug, lastModified]) => ({ url: `${base}/organizers/${slug}`, lastModified, changeFrequency: "weekly" as const })),
  ];
}
