import { expect, it } from "vitest";
import { discoverySchema, discoveryUrl } from "@/lib/discovery";
import { calendarFile } from "@/lib/calendar-file";
import { eventQuality } from "@/lib/event-quality";

it("validates ranges and coordinates and retains filters in shareable URLs", () => {
  expect(discoverySchema.safeParse({ min: 100, max: 10 }).success).toBe(false);
  expect(
    discoverySchema.safeParse({ from: "2027-02-02", to: "2027-02-01" }).success,
  ).toBe(false);
  expect(discoverySchema.safeParse({ lat: 12 }).success).toBe(false);
  expect(discoverySchema.safeParse({ page: -1 }).success).toBe(false);
  const url = new URL(
    discoveryUrl(
      { q: "Music & dance", category: "Music|Arts", page: 5, city: "Pune" },
      { city: "", mode: "ONLINE" },
    ),
    "https://example.test",
  );
  expect(url.searchParams.get("q")).toBe("Music & dance");
  expect(url.searchParams.get("category")).toBe("Music|Arts");
  expect(url.searchParams.has("city")).toBe(false);
  expect(url.searchParams.has("page")).toBe(false);
  expect(url.searchParams.get("mode")).toBe("ONLINE");
});
it("normalizes online discovery and omits irrelevant nearby restrictions", () => {
  const filters = discoverySchema.parse({
    q: "Workshop",
    mode: "ONLINE",
    city: "Pune",
    lat: 18.52,
    lng: 73.85,
    radius: 5,
    price: "free",
    period: "weekend",
  });
  expect(filters).toMatchObject({
    mode: "ONLINE",
    city: "",
    lat: undefined,
    lng: undefined,
    price: "free",
    period: "weekend",
  });
  const url = new URL(discoveryUrl(filters), "https://example.test");
  for (const key of ["city", "lat", "lng", "radius"])
    expect(url.searchParams.has(key)).toBe(false);
  expect(url.searchParams.get("q")).toBe("Workshop");
  expect(
    new URL(
      discoveryUrl(discoverySchema.parse({})),
      "https://example.test",
    ).searchParams.has("radius"),
  ).toBe(false);
  expect(
    new URL(
      discoveryUrl(
        discoverySchema.parse({ lat: 18.52, lng: 73.85, radius: 10 }),
      ),
      "https://example.test",
    ).searchParams.get("radius"),
  ).toBe("10");
});

it("exports calendar text without line injection and folds Unicode safely", () => {
  const result = calendarFile(
    {
      id: "test",
      title: "Dance, night;\nBEGIN:VEVENT" + "रौनक".repeat(40),
      startsAt: new Date("2027-01-01T12:00:00Z"),
      endsAt: new Date("2027-01-01T14:00:00Z"),
      city: "Pune",
      venueName: "Hall",
      address: null,
    },
    "https://example.test/e/night",
  );
  expect(result.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  expect(result).toContain("SUMMARY:Dance\\, night\\;\\nBEGIN:VEVENT");
  expect(result).toContain("DTSTART:20270101T120000Z");
  for (const line of result.split("\r\n"))
    expect(Buffer.byteLength(line)).toBeLessThanOrEqual(73);
  expect(result).not.toContain("\r\nBEGIN:VEVENT\r\nBEGIN:VEVENT");
});
it("reports image and content review warnings without rejecting subjective choices", () => {
  const warnings = eventQuality({
    title: "Hi",
    category: "Unrecognized",
    summary: null,
    mode: "HYBRID",
    city: null,
    venueName: null,
    address: null,
    onlineUrl: null,
    startsAt: new Date(),
    endsAt: new Date(),
    ticketTypes: [],
    images: [{ kind: "COVER", width: 100, height: 500, variants: {} }],
    org: { name: "Organizer", supportEmail: null, supportPhone: null },
  });
  expect(warnings.some((v) => v.includes("unusual ratio"))).toBe(true);
  expect(warnings.some((v) => v.includes("category"))).toBe(true);
  expect(warnings.some((v) => v.includes("contact"))).toBe(true);
  expect(warnings.some((v) => v.includes("joining link"))).toBe(true);
  expect(warnings).toContain(
    "Add at least one ticket type with a price before publishing.",
  );
});

it("accepts a free ticket as valid pricing and warns about an invalid schedule", () => {
  const warnings = eventQuality({
    title: "A community night",
    category: "Community & celebrations",
    summary: "Meet neighbors and share a good evening.",
    description: "A welcoming community evening with music, food, and time to meet new people.",
    mode: "IN_PERSON",
    city: "Pune",
    venueName: "Community Hall",
    address: "Main Street",
    onlineUrl: null,
    startsAt: new Date("2026-11-20T13:00:00Z"),
    endsAt: new Date("2026-11-20T12:00:00Z"),
    ticketTypes: [{ pricePaise: 0 }],
    images: [{ kind: "COVER", width: 1280, height: 720, variants: { card: true } }],
    org: { name: "Local Club", supportEmail: "hello@example.test", supportPhone: null },
  });
  expect(warnings.some((warning) => warning.toLowerCase().includes("price"))).toBe(false);
  expect(warnings).toContain("Check that the event end is after its start.");
});
