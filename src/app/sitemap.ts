export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { db } from "@/server/db/client";
import { publicListing } from "@/server/public/events";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || "http://localhost:3000";
  const events = await db.event.findMany({
    where: publicListing,
    select: { slug: true, updatedAt: true },
  });
  return [
    { url: base, changeFrequency: "weekly" },
    ...["privacy", "terms", "contact"].map((path) => ({
      url: `${base}/${path}`,
      changeFrequency: "monthly" as const,
    })),
    { url: `${base}/discover`, changeFrequency: "daily" },
    ...events.map((event) => ({
      url: `${base}/e/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: "daily" as const,
    })),
  ];
}
