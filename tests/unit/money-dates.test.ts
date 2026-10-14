import { describe, expect, it } from "vitest";
import { parseInrToPaise } from "@/lib/money";
import { localEventTimeToUtc, utcToLocalEventTime } from "@/lib/dates";

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
});
