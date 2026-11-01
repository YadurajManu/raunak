import { describe, expect, it } from "vitest";
import {
  formatEventTime,
  formatTotal,
} from "@/components/public/ticket-selector";

describe("ticket selector formatting", () => {
  it("formats the event recap in the event timezone, including the local date", () => {
    // This UTC timestamp is already the evening of Saturday in India.
    expect(formatEventTime("2026-11-07T14:30:00.000Z", "Asia/Kolkata")).toBe(
      "Sat, 7 Nov · 8:00 pm IST",
    );
  });

  it("shows no total before a ticket is selected", () => {
    expect(formatTotal(0, 500)).toBe("—");
  });

  it("shows Free when selected tickets total zero", () => {
    expect(formatTotal(1, 0)).toBe("Free");
  });

  it("shows the amount for selected paid tickets", () => {
    expect(formatTotal(2, 500)).toBe("₹5");
  });
});
