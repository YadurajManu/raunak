import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { postLoginPath } from "@/lib/auth-next";
import type { Metadata } from "next";
import { faqSchema, marketing } from "@/config/marketing";
import { pricing, standardFeeLabel } from "@/config/pricing";
import { APP_NAME } from "@/lib/constants";
import dynamic from "next/dynamic";
const RouteFooter = dynamic(() => import("@/components/marketing/footer").then((module) => module.RouteFooter));
const PricingAndFaq = dynamic(() =>
  import("@/components/marketing/closing").then(
    (module) => module.PricingAndFaq,
  ),
);
const Features = dynamic(() =>
  import("@/components/marketing/features").then((module) => module.Features),
);
const MessageCustomizer = dynamic(() =>
  import("@/components/marketing/features").then(
    (module) => module.MessageCustomizer,
  ),
);
const Story = dynamic(() =>
  import("@/components/marketing/story").then((module) => module.Story),
);
import { Hero } from "@/components/marketing/hero";

export const metadata: Metadata = {
  title: `${APP_NAME} — Throw the event. We'll handle the door.`,
  description:
    "Ticketing, UPI payments, WhatsApp reminders and QR check-in, in one calm dashboard. Your first event is free to host.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${APP_NAME} — Throw the event. We’ll handle the door.`,
    description: marketing.hero.subhead,
    type: "website",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
};
export default async function MarketingPage() {
  const user = await currentUser();
  if (user) redirect(postLoginPath(user));
  const base = process.env.APP_URL || "http://localhost:3000";
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: APP_NAME,
      url: base,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: APP_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: marketing.hero.subhead,
      offers: {
        "@type": "Offer",
        price: pricing.firstEvent.platformFeePaise / 100,
        priceCurrency: "INR",
        description: `First event platform fee. After that: ${standardFeeLabel()}. Payment gateway charges apply.`,
      },
    },
    faqSchema(),
  ];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
      <main id="main">
        <Hero />
        <Story />
        <Features />
        <MessageCustomizer />
        <PricingAndFaq />
      </main>
      <RouteFooter pathname="/" landing />
    </>
  );
}
