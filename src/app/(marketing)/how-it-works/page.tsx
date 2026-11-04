import type { Metadata } from "next";
import Link from "next/link";
import { marketing } from "@/config/marketing";
import { RouteFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "How to host and sell event tickets in India | Raunak",
  description: "Create an event, publish ticket types, share the booking link and scan QR tickets at the door. Learn how Raunak handles paid and free tickets in India.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return <><main className="m-legal m-container"><div className="m-legal-content">
    <p className="m-eyebrow">HOSTING WITH RAUNAK</p>
    <h1>How to host an event on Raunak</h1>
    <p>Raunak gives organizers one place to publish an event, create free or paid tickets, share a booking link and check guests in. Attendees book online and receive a QR ticket by email. WhatsApp delivery is available when the organizer enables it and the attendee opts in.</p>
    <h2>1. Create and publish your event</h2><p>Add the date, venue or online details, images, refund policy and ticket types. Publish when the page is ready to share.</p>
    <h2>2. Share the booking link</h2><p>Attendees choose tickets and pay through Cashfree for paid bookings. Free tickets skip payment.</p>
    <h2>3. Deliver tickets</h2><p>Issued QR tickets are sent by email and remain available under My tickets. WhatsApp messages depend on event settings and consent.</p>
    <h2>4. Check guests in</h2><p>Assigned staff scan each QR code or search for an attendee. Repeat scans are flagged.</p>
    <h2>Is hosting free?</h2><p>{marketing.faq[0].answer}</p>
    <h2>More questions</h2>{marketing.faq.slice(1).map(({ question, answer }) => <section key={question}><h3>{question}</h3><p>{answer}</p></section>)}
    <p><Link href="/discover">Explore public events</Link> · <Link href="/docs/organizers">Read the organizer guide</Link> · <Link href="/contact">Contact Raunak</Link></p>
  </div></main><RouteFooter pathname="/how-it-works" /></>;
}
