import { describe, expect, it } from "vitest";
import { eventCalendarOptions } from "@/lib/event-calendar";
import { calendarFile } from "@/lib/calendar-file";

const event = {
  id: "event-id",
  title: "Music & friends",
  description: "An evening together, with music.",
  startsAt: new Date("2026-11-15T12:00:00Z"),
  endsAt: new Date("2026-11-15T14:00:00Z"),
  timezone: "Asia/Kolkata",
  venueName: "Hall",
  address: "MG Road",
  city: "Pune",
};
const url = "https://raunak.example/e/music";
describe("event action calendar options", () => {
  it("uses real UTC instants, timezone, venue, description and only the event URL", () => {
    const links = eventCalendarOptions(event, url)!;
    const google = new URL(links.google).searchParams;
    const outlook = new URL(links.outlook).searchParams;
    expect(google.get("dates")).toBe("20261115T120000Z/20261115T140000Z");
    expect(google.get("ctz")).toBe("Asia/Kolkata");
    expect(google.get("location")).toBe("Hall, MG Road, Pune");
    expect(outlook.get("startdt")).toBe(event.startsAt.toISOString());
    expect(outlook.get("enddt")).toBe(event.endsAt.toISOString());
    expect(outlook.get("body")).toContain(event.description);
    expect(google.get("details")).toContain(url);
    expect(calendarFile(event, url)).toContain(
      "DESCRIPTION:An evening together\\, with music.",
    );
  });
  it("does not offer links for invalid dates, timezone, title or ticket URLs", () => {
    for (const patch of [
      { startsAt: new Date(NaN) },
      { endsAt: event.startsAt },
      { timezone: "invalid" },
      { title: " " },
    ])
      expect(eventCalendarOptions({ ...event, ...patch }, url)).toBeNull();
    expect(
      eventCalendarOptions(event, "https://raunak.example/t/private"),
    ).toBeNull();
    expect(eventCalendarOptions(event, "javascript:alert(1)")).toBeNull();
  });
  it("supports missing optional venue and description data", () => {
    const links = eventCalendarOptions(
      {
        ...event,
        venueName: null,
        city: null,
        address: null,
        description: null,
      },
      url,
    )!;
    expect(new URL(links.google).searchParams.get("location")).toBe("");
    expect(new URL(links.google).searchParams.get("details")).toBe(
      `Event details: ${url}`,
    );
  });
});
