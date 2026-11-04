import type { Metadata } from "next";
import Link from "next/link";
import { RouteFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "About Raunak | Event ticketing for organizers in India",
  description: "Raunak is an India-first event management and ticketing platform. Learn what it does, how tickets are delivered and where to find product and contact information.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return <><main className="m-legal m-container"><div className="m-legal-content"><p className="m-eyebrow">ABOUT RAUNAK</p><h1>Events made easier to run</h1>
    <p>Raunak is an India-first event management and ticketing platform. Organizers can publish an event, sell or issue tickets, manage a team and check guests in. Attendees can discover public events, book tickets and access their QR tickets by email or in My tickets.</p>
    <h2>Why Raunak exists</h2><p>Event details, booking records and entry checks belong in one place. Raunak brings these steps together for organizers and their guests.</p>
    <h2>Who builds it</h2><p>Raunak is developed in the open. The <a href="https://github.com/YadurajManu/raunak">source repository</a> documents its contributors and current implementation.</p>
    <h2>Get in touch</h2><p>For Raunak support, visit <Link href="/contact">contact</Link>. For a specific event, use the contact option on that event page.</p>
  </div></main><RouteFooter pathname="/about" /></>;
}
