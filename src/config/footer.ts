export type FooterAudience = "anon" | "attendee" | "organizer" | "staff";

export const footerConfig = {
  full: ["/", "/discover", "/e/", "/organizers/", "/account", "/saved", "/my-tickets", "/orders/", "/help", "/refunds", "/contact", "/privacy", "/terms", "/legal"],
  minimal: ["/login", "/signup", "/onboarding", "/accept-invite/", "/organizer/setup", "/checkout-preview", "/checkout/", "/t/"],
  none: ["/dashboard", "/admin", "/style-guide", "/checkin"],
  groups: [
    { title: "Explore", links: [{ label: "All events", href: "/discover", visibleTo: ["anon", "attendee", "organizer", "staff"] }] },
    { title: "Attendees", links: [
      { label: "Discover events", href: "/discover", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "My plans", href: "/account", visibleTo: ["attendee", "organizer", "staff"] },
      { label: "Saved", href: "/saved", visibleTo: ["attendee", "organizer", "staff"] },
      { label: "Help for attendees", href: "/help#attendees", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "Refunds and cancellations", href: "/refunds", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "Ticket not received?", href: "/help#ticket-not-received", visibleTo: ["anon", "attendee", "organizer", "staff"] },
    ] },
    { title: "Organizers", links: [
      { label: "Host an event", href: "/dashboard", visibleTo: ["anon", "attendee", "staff"] },
      { label: "Create event", href: "/dashboard/events/new", visibleTo: ["organizer"] },
      { label: "How it works", href: "/#how-it-works", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "Features", href: "/#features", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "Pricing", href: "/#pricing", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "FAQ", href: "/#faq", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "Organizer guide", href: "/docs", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "Dashboard", href: "/dashboard", visibleTo: ["organizer"] },
    ] },
    { title: "Support & company", links: [
      { label: "Help", href: "/help", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "Contact", href: "/contact", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "Privacy", href: "/privacy", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "Terms", href: "/terms", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "Docs", href: "/docs", visibleTo: ["anon", "attendee", "organizer", "staff"] },
      { label: "Sitemap", href: "/sitemap.xml", visibleTo: ["anon", "attendee", "organizer", "staff"] },
    ] },
  ],
} as const;

export function footerVariantForPath(path: string): "full" | "minimal" | "none" {
  const matches = (routes: readonly string[]) => routes.some((route) => path === route || (route !== "/" && path.startsWith(route.endsWith("/") ? route : `${route}/`)));
  if (matches(footerConfig.none)) return "none";
  if (matches(footerConfig.minimal)) return "minimal";
  return matches(footerConfig.full) ? "full" : "none";
}
