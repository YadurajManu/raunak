import { describe, expect, it } from "vitest";
import { parseInrToPaise } from "@/lib/money";
import { localEventTimeToUtc, updateLocalEventTimePart, utcToLocalEventTime } from "@/lib/dates";

describe("money and event time", () => {
  it("uses exact integer paise", () => {
    expect(parseInrToPaise("499.50")).toBe(49950);
    expect(() => parseInrToPaise("499.999")).toThrow();
  });
  it("round trips event time in IST", () => {
    const utc = localEventTimeToUtc("2027-02-20T18:30", "Asia/Kolkata");
    expect(utc).toBe("2027-02-20T13:00:00Z");
    expect(utcToLocalEventTime(utc, "Asia/Kolkata")).toBe("2027-02-20T18:30");
  });
  it("preserves the other half of a split date and time input", () => {
    expect(updateLocalEventTimePart("2026-11-05T17:00", "date", "2026-11-06")).toBe("2026-11-06T17:00");
    expect(updateLocalEventTimePart("2026-11-05T17:00", "time", "18:15")).toBe("2026-11-05T18:15");
    expect(updateLocalEventTimePart("", "date", "")).toBe("");
  });
});
