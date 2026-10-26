export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { db } from "@/server/db/client";
import { publicListing } from "@/server/public/events";
import { docsPages } from "@/lib/docs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || "http://localhost:3000";
  // Keep the static sitemap available during a transient database outage.
  const events = await db.event.findMany({
    where: publicListing,
    select: { slug: true, updatedAt: true },
  }).catch(() => []);
  return [
    { url: base, changeFrequency: "weekly" },
    ...["privacy", "terms", "contact", "help", "refunds"].map((path) => ({
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
  ];
}
