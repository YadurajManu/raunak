import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = "https://raunak.yaduraj.me";
  const disallow = ["/api/", "/dashboard/", "/account", "/auth/", "/login", "/signup", "/onboarding", "/organizer/setup", "/checkout", "/checkout-preview", "/orders/", "/t/", "/my-tickets", "/saved", "/admin", "/style-guide", "/accept-invite/"];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }, { userAgent: ["Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Google-Extended", "Applebot-Extended"], allow: "/", disallow }],
    sitemap: `${base}/sitemap.xml`,
  };
}
