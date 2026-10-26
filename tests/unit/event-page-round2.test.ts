import { describe, expect, it } from "vitest";
import { lintEvent } from "@/lib/event-description-lint";
import { plainName } from "@/lib/plain-name";

const start = new Date("2026-11-05T11:30:00.000Z");

describe("public event content checks", () => {
  it("flags duplicate structured details and a venue announced as TBA", () => {
    const issues = lintEvent({
      description: "Date: 5 Nov 2026\nTime: 5:00 pm\nFinal venue to be announced",
      startsAt: start,
      endsAt: new Date("2026-11-05T14:30:00.000Z"),
      timezone: "Asia/Kolkata",
      venueName: "Ganga Valley",
      address: "Haridwar",
      published: true,
    });
    expect(
      issues.some((issue) => issue.message.includes("already shown")),
    ).toBe(true);
    expect(
      issues.some(
        (issue) =>
          issue.severity === "error" &&
          issue.message.includes("venue is not announced"),
      ),
    ).toBe(true);
  });

  it("marks a published date/time conflict as an error, without changing the source text", () => {
    const issues = lintEvent({
      description: "Date: 06/11/2026\nTime: 6:00 pm",
      startsAt: start,
      endsAt: new Date("2026-11-05T14:30:00.000Z"),
      timezone: "Asia/Kolkata",
      published: true,
    });
    expect(
      issues.some(
        (issue) =>
          issue.severity === "error" && issue.message.includes("conflicts"),
      ),
    ).toBe(true);
  });

  it("checks explicit end date and time against the structured event end", () => {
    const issues = lintEvent({
      description: "End date: 06/11/2026\nEnd time: 6:00 pm",
      startsAt: start,
      endsAt: new Date("2026-11-05T14:30:00.000Z"),
      timezone: "Asia/Kolkata",
    });
    const conflict = issues.find((issue) => issue.message.includes("conflicts"));
    expect(conflict?.severity).toBe("warning");
  });

  it("warns about ticket-name emoji and incomplete organizer profile only when profile fields are known", () => {
    const issues = lintEvent({
      description: "A music gathering for the neighborhood.",
      startsAt: start,
      ticketTypes: [{ name: "Early Bird ✨" }],
      organizer: { tagline: "", logoKey: null },
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      "Emoji in ticket names can break on PDFs and WhatsApp cards. Use plain text.",
      "Complete the organizer profile with a tagline and logo to help guests recognize who is hosting.",
    ]);
  });

  it("checks ticket and organizer details even when the description is blank", () => {
    expect(
      lintEvent({
        description: "",
        startsAt: start,
        ticketTypes: [{ name: "Pass 🎟️" }],
        organizer: { tagline: null, logoKey: null },
      }),
    ).toHaveLength(2);
  });
});

it("removes pictographs from ticket names used in PDFs and plain-text messages", () => {
  expect(plainName("Early Bird ✨ 🪔 💎")).toBe("Early Bird");
  expect(plainName("Garba 💃🏽 Night")).toBe("Garba Night");
  expect(plainName("General Entry")).toBe("General Entry");
  expect(plainName("दिल्ली गरबा ✨")).toBe("दिल्ली गरबा");
});
