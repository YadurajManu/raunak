import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
const mock = vi.hoisted(() => ({ discoverPage: vi.fn() }));
vi.mock("@/server/public/events", () => mock);
import { GET } from "@/app/api/mobile/discover/route";
beforeEach(() => vi.resetAllMocks());
it("returns public card fields without exposing internal event or organizer data", async () => {
  mock.discoverPage.mockResolvedValue({
    events: [
      {
        id: "event",
        slug: "public-event",
        title: "Workshop",
        summary: "Learn together",
        category: "Workshops & classes",
        city: "Delhi",
        mode: "IN_PERSON",
        startsAt: new Date("2026-11-20T12:30:00Z"),
        timezone: "Asia/Kolkata",
        venueName: "Studio",
        org: { name: "Host", supportEmail: "private@example.test" },
        images: [
          {
            kind: "POSTER",
            variants: { card: { webp: "/api/media/poster.webp" } },
          },
        ],
        ticketTypes: [{ pricePaise: 5000 }, { pricePaise: 1000 }],
        reviewNote: "private",
      },
    ],
    total: 13,
    filters: { page: 1 },
  });
  const response = await GET(
    new Request("https://raunak.example/api/mobile/discover?city=Delhi"),
  );
  const data = await response.json();
  expect(mock.discoverPage).toHaveBeenCalledWith({ city: "Delhi" });
  expect(data.events[0].pricePaise).toBe(1000);
  expect(data.events[0].publicUrl).toContain("/e/public-event");
  expect(data.events[0].imageUrl).toContain("/api/media/poster.webp");
  expect(data.events[0].dateLabel).toContain("6:00");
  expect(JSON.stringify(data)).not.toContain("private");
  expect(data.hasMore).toBe(true);
});
it("distinguishes invalid filters from backend failures", async () => {
  const invalid = z.object({ page: z.number() }).safeParse({ page: "bad" });
  mock.discoverPage.mockRejectedValue(invalid.error);
  expect(
    (await GET(new Request("https://raunak.example/api/mobile/discover")))
      .status,
  ).toBe(400);
  mock.discoverPage.mockRejectedValue(new Error("private database details"));
  const response = await GET(
    new Request("https://raunak.example/api/mobile/discover"),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("database details");
});
it("returns a genuine empty result rather than placeholder listings", async () => {
  mock.discoverPage.mockResolvedValue({
    events: [],
    total: 0,
    filters: { page: 1 },
  });
  const data = await (
    await GET(new Request("https://raunak.example/api/mobile/discover"))
  ).json();
  expect(data.events).toEqual([]);
  expect(data.hasMore).toBe(false);
});
