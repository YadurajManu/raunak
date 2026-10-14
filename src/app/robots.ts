import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL || "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard/",
        "/my-tickets",
        "/login",
        "/signup",
        "/style-guide",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
