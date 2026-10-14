import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";

export const metadata: Metadata = { title: `${APP_NAME} — Throw the event. We'll handle the door.`, description: "Ticketing, UPI payments, WhatsApp reminders and QR check-in, in one calm dashboard. Your first event is free to host.", alternates: { canonical: "/" } };
export default function MarketingPage() { return <><MarketingNav/><main id="main"><Hero/></main></>; }
