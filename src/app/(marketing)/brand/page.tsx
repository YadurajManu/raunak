import type { Metadata } from "next";
import Link from "next/link";
import { RouteFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Raunak brand and press | Official description and logos",
  description: "Use the official Raunak name, event ticketing description and downloadable icons. Find the product pages and contact route for press or brand questions.",
  alternates: { canonical: "/brand" },
};

export default function BrandPage() {
  return <><main className="m-legal m-container"><div className="m-legal-content"><p className="m-eyebrow">BRAND & PRESS</p><h1>Raunak, in a few words</h1>
    <h2>One line</h2><p>Raunak helps organizers in India run events, send QR tickets and check guests in.</p>
    <h2>Short description</h2><p>Raunak is an India-first event management and ticketing platform. Organizers can publish event pages, offer free or paid tickets, manage team access and scan QR tickets at entry. Attendees can book online and find tickets in their account. Email delivers issued tickets; WhatsApp delivery is available when enabled and consented to.</p>
    <h2>More about the product</h2><p>Raunak brings event setup, ticket sales and guest entry into one dashboard. Organizers add their event details, images, ticket types and refund policy, then share a public booking link. Paid bookings use Cashfree checkout; free tickets skip payment. An issued ticket has a signed QR code for check-in, and repeat scans are flagged. Team members can be assigned roles for event management or entry. Attendees receive tickets by email and can retrieve them from My tickets. WhatsApp messaging depends on organizer settings, provider availability and attendee consent. The first event has no Raunak platform fee, while payment gateway charges still apply to paid tickets. Later paid events use the published platform fee. Public event pages show the organizer’s own event details and policies; Raunak does not replace those event-specific terms. The product is built for organizers and attendees in India, with INR pricing and a mobile-friendly booking flow.</p>
    <h2>Logos and icons</h2><p><a href="/icon.svg" download>Download SVG icon</a> · <a href="/brand/icon-512.png" download>Download PNG icon</a></p>
    <h2>Contact</h2><p>For brand questions, use the <Link href="/contact">Raunak contact page</Link>.</p>
  </div></main><RouteFooter pathname="/brand" /></>;
}
