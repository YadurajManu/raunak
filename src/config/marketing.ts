import { firstEventLabel, standardFeeLabel } from "./pricing";

export const marketing = {
  nav: [
    { label: "How it works", href: "#how-it-works" },
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  primaryCta: {
    label: "Host your first event — free",
    href: "/signup?intent=organizer",
  },
  secondaryCta: { label: "Browse events", href: "/discover" },
  hero: {
    eyebrow: "Your first event is free to host",
    headline: "Throw the event. We'll handle the door.",
    subhead:
      "Ticketing, UPI payments, WhatsApp reminders and QR check-in, in one calm dashboard. Set up your event in ten minutes.",
    micro: "No card needed · First event free · UPI, cards & netbanking",
  },
  eventTypes: [
    "College fests",
    "Workshops",
    "Comedy nights",
    "Hackathons",
    "Meetups",
    "Concerts",
    "Club events",
    "Conferences",
  ],
  steps: [
    {
      number: "01",
      title: "Set it up in ten minutes",
      copy: "Add your poster, details and ticket types. Publish when you're ready.",
      screen: "editor",
    },
    {
      number: "02",
      title: "Share a link, get paid",
      copy: "Attendees pay with UPI, cards or netbanking. Every order is tracked.",
      screen: "checkout",
    },
    {
      number: "03",
      title: "Tickets land where people already are",
      copy: "A QR ticket arrives by email and WhatsApp within seconds.",
      screen: "chat",
    },
    {
      number: "04",
      title: "Scan. Beep. Welcome.",
      copy: "Check guests in from any phone. Double scans are caught instantly.",
      screen: "scanner",
    },
  ],
  faq: [
    {
      question: "Is it really free?",
      answer: `Yes. Your first event is free to host: no setup fee, no monthly fee, no platform fee (${firstEventLabel()}). If you sell paid tickets, the payment gateway charges its standard processing fee. After your first event, ${standardFeeLabel()} applies on paid tickets; free tickets stay free.`,
    },
    {
      question: "How do attendees pay?",
      answer: "UPI, cards, netbanking and wallets through Cashfree checkout.",
    },
    {
      question: "Do attendees need an app?",
      answer:
        "No. Their QR ticket arrives by email and WhatsApp, and stays available on their My tickets page.",
    },
    {
      question: "How do WhatsApp messages work?",
      answer:
        "Confirmations and reminders send automatically. You can customize the message from your dashboard.",
    },
    {
      question: "Can my team help run the event?",
      answer:
        "Invite members, give them roles and assign them to events. Gate staff only see check-in.",
    },
    {
      question: "What about refunds and cancellations?",
      answer:
        "You set the refund policy for each event. Attendees can read it before checkout.",
    },
    {
      question: "Can I run free events?",
      answer: "Yes. Free tickets skip payment entirely.",
    },
  ],
  footer: [
    {
      label: "Product",
      links: [
        { label: "How it works", href: "#how-it-works" },
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "FAQ", href: "#faq" },
      ],
    },
    {
      label: "Organizers",
      links: [
        { label: "Host an event", href: "/signup?intent=organizer" },
        { label: "Log in", href: "/login" },
        { label: "Dashboard", href: "/dashboard" },
      ],
    },
    {
      label: "Attendees",
      links: [
        { label: "Discover events", href: "/discover" },
        { label: "My tickets", href: "/my-tickets" },
      ],
    },
    {
      label: "Company",
      links: [
        { label: "Contact", href: "/contact" },
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    },
  ],
} as const;

export function faqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: marketing.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
