import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  publicEvent: vi.fn(),
  currentUser: vi.fn(),
  findSaved: vi.fn(),
}));
vi.mock("@/server/public/events", () => ({ publicEvent: mocks.publicEvent }));
vi.mock("@/server/auth/session", () => ({ currentUser: mocks.currentUser }));
vi.mock("@/server/db/client", () => ({
  db: { savedEvent: { findUnique: mocks.findSaved } },
}));
import { GET } from "@/app/api/mobile/events/[slug]/route";
const fixture = () => ({
  id: "event-id",
  slug: "dance-night",
  title: "Dance night",
  summary: "Community dance",
  description: "Meet us",
  status: "PUBLISHED",
  mode: "IN_PERSON",
  startsAt: new Date(Date.now() + 86400000),
  endsAt: new Date(Date.now() + 90000000),
  timezone: "Asia/Kolkata",
  venueName: "Studio",
  address: "Main Road",
  city: "Delhi",
  lat: null,
  lng: null,
  refundPolicy: null,
  onlineUrl: "PRIVATE-JOIN-LINK",
  org: {
    id: "org",
    slug: "host",
    name: "Host",
    tagline: null,
    logoKey: null,
    supportEmail: "private@example.test",
  },
  images: [],
  people: [
    { name: "Private staff", title: "Admin" },
    { name: "Artist", title: "DJ", bio: "Music", photoKey: null },
  ],
  ticketTypes: [
    {
      id: "ticket",
      name: "Entry",
      description: null,
      pricePaise: 500,
      quantityTotal: 100,
      quantitySold: 2,
      quantityHeld: 3,
      minPerOrder: 1,
      maxPerOrder: 5,
      isHidden: false,
      saleStartsAt: null,
      saleEndsAt: null,
    },
    { id: "hidden", name: "Hidden", isHidden: true },
  ],
});
const request = () =>
  new Request("https://raunak.example/api/mobile/events/dance-night");
const context = { params: Promise.resolve({ slug: "dance-night" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.currentUser.mockResolvedValue(null);
  mocks.publicEvent.mockResolvedValue(fixture());
});
it("returns public event content and actual availability without private staff or join links", async () => {
  const response = await GET(request(), context);
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(data.tickets).toHaveLength(1);
  expect(data.tickets[0]).toMatchObject({
    remaining: 95,
    available: true,
    pricePaise: 500,
  });
  expect(data.people.map((p: { name: string }) => p.name)).toEqual(["Artist"]);
  expect(JSON.stringify(data)).not.toMatch(
    /PRIVATE-JOIN-LINK|private@example|Private staff/,
  );
  expect(data.calendarGoogleUrl).toContain("calendar.google.com");
});
it("does not offer tickets for cancelled or started events", async () => {
  mocks.publicEvent.mockResolvedValue({ ...fixture(), status: "CANCELLED" });
  expect(
    (await (await GET(request(), context)).json()).tickets[0].available,
  ).toBe(false);
  mocks.publicEvent.mockResolvedValue({
    ...fixture(),
    startsAt: new Date(Date.now() - 60000),
  });
  expect(
    (await (await GET(request(), context)).json()).tickets[0].available,
  ).toBe(false);
});
it("returns404 for unavailable events and loads only the authenticated viewer saved state", async () => {
  mocks.publicEvent.mockResolvedValueOnce(null);
  expect((await GET(request(), context)).status).toBe(404);
  mocks.currentUser.mockResolvedValue({ id: "user-id" });
  mocks.findSaved.mockResolvedValue({ eventId: "event-id" });
  expect((await (await GET(request(), context)).json()).saved).toBe(true);
  expect(mocks.findSaved).toHaveBeenCalledWith({
    where: { userId_eventId: { userId: "user-id", eventId: "event-id" } },
    select: { eventId: true },
  });
});
