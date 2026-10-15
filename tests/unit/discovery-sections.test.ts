import { expect, it } from "vitest";
import { discoverySections } from "@/lib/discovery-sections";
const now = new Date("2026-10-15T10:00:00Z");
const records = Array.from({ length: 8 }, (_, index) => ({
  id: String(index),
  city: index === 4 || index === 5 ? "Pune" : "Delhi",
  category: index >= 6 ? "Workshops & classes" : "Music & nightlife",
  startsAt: new Date("2026-11-01T10:00:00Z"),
  createdAt: new Date("2026-09-01T10:00:00Z"),
  ticketTypes: [{ pricePaise: index === 4 || index === 5 ? 0 : 10000 }],
}));
it("keeps low inventory together without inventing sections", () => {
  for (const count of [0, 1, 2, 3, 7]) {
    const result = discoverySections(records.slice(0, count), "Pune", now);
    expect(result.primary).toHaveLength(count);
    expect(result.sections).toHaveLength(0);
  }
});
it("groups real matching events once and retains every result", () => {
  const result = discoverySections(records, "Pune", now);
  expect(result.sections.map((section) => section.title)).toEqual([
    "Around Pune",
    "Workshops & classes",
  ]);
  const ids = [
    ...result.primary,
    ...result.sections.flatMap((section) => section.events),
  ].map((event) => event.id);
  expect(new Set(ids).size).toBe(records.length);
  expect(ids).toHaveLength(records.length);
  expect(result.sections.every((section) => section.events.length >= 2)).toBe(
    true,
  );
});
it("uses India weekend dates and real zero-price tickets", () => {
  const free = discoverySections(records, null, now);
  expect(free.sections[0].title).toBe("Good plans, free entry");
  const weekend = records.map((event, index) => ({
    ...event,
    startsAt: new Date(
      index >= 4 && index <= 5
        ? "2026-10-17T10:00:00Z"
        : "2026-11-01T10:00:00Z",
    ),
  }));
  expect(discoverySections(weekend, null, now).sections[0].title).toBe(
    "Happening this weekend",
  );
});
