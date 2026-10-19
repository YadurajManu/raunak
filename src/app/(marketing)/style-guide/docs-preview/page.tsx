import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { DiscoverFilters } from "@/components/public/discover-filters";
import { EventCard } from "@/components/public/event-card";
import { EventForm } from "@/components/dashboard/event-form";
import { CheckinScanner } from "@/components/dashboard/checkin-scanner";
import { discoverySchema } from "@/lib/discovery";

const sampleId = "b848f6c5-d485-4f25-b798-0278e72e8943";

export default async function DocumentationPreview({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { screen = "discover" } = await searchParams;
  if (!["discover", "organizer", "check-in"].includes(screen)) notFound();
  const events = [
    {
      id: sampleId,
      slug: "sample-campus-fest",
      title: "Campus Fest 2027",
      startsAt: new Date("2027-02-20T04:30:00Z"),
      city: "Pune",
      venueName: "Sample campus lawn",
      category: "Community & celebrations",
      image: "/seed/campus-fest.svg",
      pricePaise: 49900,
    },
    {
      id: "e9891273-5dbf-4a0f-871b-c76fa07be897",
      slug: "sample-design-workshop",
      title: "Design Workshop",
      startsAt: new Date("2027-03-12T03:30:00Z"),
      city: "Mumbai",
      venueName: "Sample creative studio",
      category: "Workshops & classes",
      image: "/seed/design-workshop.svg",
      pricePaise: 0,
    },
  ];
  return (
    <main className="market-page d-discover" data-docs-preview={screen}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingBottom: 20, marginBottom: 28, borderBottom: "1px solid var(--line)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display)", fontSize: 30 }}>
          <BrandMark className="gnav-logo-mark" /> Raunak
        </span>
        <span className="m-mono" style={{ fontSize: 11, color: "var(--accent-ink)", textAlign: "right" }}>SAMPLE DATA · PRODUCT PREVIEW</span>
      </div>
      {screen === "discover" ? (
        <>
          <section className="d-hero">
            <div>
              <p className="m-eyebrow">GOOD PEOPLE. GREAT PLANS.</p>
              <h1>Find your next <em className="m-serif">raunak.</em></h1>
            </div>
          </section>
          <DiscoverFilters filters={discoverySchema.parse({})} availableCities={["Pune", "Mumbai"]} />
          <div className="d-results-heading"><div><h2>Explore upcoming events</h2><p>2 sample events</p></div></div>
          <ul className="market-grid">
            {events.map(({ image, pricePaise, ...event }) => (
              <EventCard key={event.id} event={{
                ...event,
                timezone: "Asia/Kolkata",
                mode: "IN_PERSON",
                org: { name: "Sample community", slug: "sample-community" },
                images: [{ kind: "COVER", alt: `${event.title} — fictional artwork`, variants: { card: { jpeg: image }, thumb: { jpeg: image }, hero: { jpeg: image } } }],
                ticketTypes: [{ pricePaise }],
              }} />
            ))}
          </ul>
        </>
      ) : screen === "organizer" ? (
        <>
          <header style={{ marginBottom: 24 }}><p className="m-eyebrow">ORGANIZER WORKSPACE</p><h1 style={{ fontSize: 36, marginBlock: 12 }}>Create your next good plan.</h1><p>Start with the details, then add your poster and tickets.</p></header>
          <EventForm orgId={sampleId} event={{
            id: sampleId,
            title: "Design Workshop",
            category: "Workshops & classes",
            visibility: "PUBLIC",
            summary: "A friendly afternoon of making, learning and sharing ideas.",
            description: "Bring a notebook and your curiosity. Work through practical design exercises, meet fellow makers, and leave with a small project of your own.",
            mode: "IN_PERSON",
            startsAt: "2027-03-12T14:00",
            endsAt: "2027-03-12T17:00",
            timezone: "Asia/Kolkata",
            venueName: "Sample creative studio",
            address: "Sample venue address",
            city: "Mumbai",
            mapUrl: null,
            onlineUrl: null,
            capacity: 40,
            refundPolicy: "Sample policy for documentation preview.",
          }} />
        </>
      ) : (
        <>
          <header style={{ marginBottom: 24 }}><p className="m-eyebrow">AT THE DOOR</p><h1 style={{ fontSize: 36, marginBlock: 12 }}>Guest check-in</h1><p>Scan a ticket or find an attendee manually.</p></header>
          <CheckinScanner eventId={sampleId} />
        </>
      )}
    </main>
  );
}
