import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DiscoverPage from "@/app/(marketing)/discover/page";
import { discoveryFilterLabels, discoverySchema } from "@/lib/discovery";

const mocks = vi.hoisted(() => ({
  results: vi.fn(),
  publicEvent: vi.fn(),
}));
vi.mock("@/server/public/events", () => ({
  discoverPage: mocks.results,
  publicListing: { status: "PUBLISHED", visibility: "PUBLIC", isTest: false },
}));
vi.mock("@/server/db/client", () => ({
  db: {
    event: { findMany: async () => [], findFirst: mocks.publicEvent },
  },
}));
vi.mock("@/server/auth/session", () => ({ currentUser: async () => null }));
vi.mock("@/components/marketing/footer", () => ({
  MarketingFooter: () => null,
}));
vi.mock("@/components/public/discover-filters", () => ({
  DiscoverFilters: () => null,
}));
vi.mock("@/components/public/event-card", () => ({ EventCard: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.results.mockResolvedValue({ events: [], total: 0 });
  mocks.publicEvent.mockResolvedValue(null);
});
async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(
    await DiscoverPage({ searchParams: Promise.resolve(params) }),
  );
}
it("invites hosting when the public marketplace is empty, even with filters", async () => {
  const html = await render({ city: "Pune" });
  expect(html).toContain("Good plans are on their way.");
  expect(html).toContain("Host an event");
  expect(html).not.toContain("Clear filters");
  expect(html).not.toContain("page 1");
  expect(html).not.toContain("Saved events");
  expect(mocks.publicEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isTest: false,
      }),
      select: { id: true },
    }),
  );
});
it("shows applied constraints and clear action when published events do not match", async () => {
  mocks.publicEvent.mockResolvedValue({ id: "public-event" });
  const html = await render({
    city: "Pune",
    q: "jazz",
    price: "free",
    period: "weekend",
  });
  expect(html).toContain("No events match these filters.");
  expect(html).toContain('aria-label="Selected filters"');
  for (const value of [
    "Pune",
    "Search: jazz",
    "Free",
    "This weekend",
    "Clear filters",
  ])
    expect(html).toContain(value);
  expect(html).not.toContain("page 1");
});
it("handles an out-of-range results page without showing fake pagination", async () => {
  mocks.results.mockResolvedValue({ events: [], total: 2 });
  const html = await render({ page: "99" });
  expect(html).toContain("No events on this page.");
  expect(html).not.toContain('aria-label="Event result pages"');
  expect(mocks.publicEvent).not.toHaveBeenCalled();
});
it("summarizes every constraint without exposing location coordinates or default sort", () => {
  expect(discoveryFilterLabels(discoverySchema.parse({}))).toEqual([]);
  const labels = discoveryFilterLabels(
    discoverySchema.parse({
      lat: 18.52,
      lng: 73.85,
      radius: 10,
      category: "Arts & culture|Other",
      from: "2027-01-01",
      to: "2027-02-01",
      mode: "HYBRID",
      price: "paid",
      min: 1000,
      max: 2500,
      organizer: "acme",
    }),
  );
  expect(labels).toEqual([
    "Within 10 km",
    "Arts & culture",
    "Other",
    "From 2027-01-01",
    "Until 2027-02-01",
    "Hybrid",
    "Paid",
    "From ₹1,000",
    "Up to ₹2,500",
    "Organizer: acme",
  ]);
});
