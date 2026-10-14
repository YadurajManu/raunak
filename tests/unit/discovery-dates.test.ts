import { expect, it } from "vitest";
import { discoveryDates } from "@/lib/discovery-dates";
it("uses India midnight boundaries and excludes past events", () => {
  const now = new Date("2026-10-14T10:00:00Z");
  expect(discoveryDates("today", undefined, now)).toEqual({ gte: now, lt: new Date("2026-10-14T18:30:00Z") });
  expect(discoveryDates("tomorrow", undefined, now)).toEqual({ gte: new Date("2026-10-14T18:30:00Z"), lt: new Date("2026-10-15T18:30:00Z") });
  expect(discoveryDates("weekend", undefined, now).lt).toEqual(new Date("2026-10-18T18:30:00Z"));
  expect(discoveryDates("month", undefined, now).lt).toEqual(new Date("2026-10-31T18:30:00Z"));
});
