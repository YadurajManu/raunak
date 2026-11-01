import { describe, expect, it } from "vitest";
import { formatEventDateRange } from "@/lib/event-date-range";

describe("formatEventDateRange", () => {
  it("keeps an overnight end time in the event timezone and adds its end date", () => {
    const value = formatEventDateRange(
      "2026-11-07T14:30:00.000Z",
      "2026-11-07T19:30:00.000Z",
      "Asia/Kolkata",
    );

    expect(value.primary).toContain("8:00 pm – 1:00 am IST");
    expect(value.secondary).toBe("Ends Sun, 8 Nov · 5 hours");
  });

  it("omits the secondary line for an event ending on the same local date", () => {
    const value = formatEventDateRange(
      "2026-11-07T14:30:00.000Z",
      "2026-11-07T17:00:00.000Z",
      "Asia/Kolkata",
    );

    expect(value.secondary).toBeNull();
  });
});
