import { expect, it } from "vitest";
import { ticketAvailability } from "@/lib/ticket-availability";
import { eventCalendarUrl } from "@/lib/event-calendar";
import { emailMarkup } from "@/server/notifications/email-markup";
const now = Date.parse("2026-10-14T12:00:00Z");
const start = "2026-10-15T12:00:00Z";
const type = {
  quantityTotal: 100,
  quantityHeld: 0,
  quantitySold: 0,
  minPerOrder: 1,
  isHidden: false,
  saleStartsAt: null,
  saleEndsAt: null,
};
it("keeps the current sale cutoff and explains each unavailable state", () => {
  const check = (overrides: Partial<typeof type> = {}, startsAt = start) =>
    ticketAvailability(
      { ...type, ...overrides },
      startsAt,
      "Asia/Kolkata",
      now,
    );
  expect(check().available).toBe(true);
  expect(
    ticketAvailability(type, start, "Asia/Kolkata", now, "DRAFT").label,
  ).toContain("publish");
  expect(check({}, new Date(now).toISOString()).label).toContain(
    "Event started",
  );
  expect(check({ isHidden: true }).label).toContain("Hidden");
  expect(check({ quantitySold: 100 }).label).toBe("Sold out");
  expect(check({ quantityHeld: 100 }).label).toContain("reserved");
  expect(check({ quantitySold: 99, minPerOrder: 2 }).available).toBe(false);
  expect(
    ticketAvailability(
      { ...type, saleStartsAt: start },
      start,
      "Asia/Kolkata",
      now,
    ).label,
  ).toContain("Sales open");
  expect(
    ticketAvailability(
      { ...type, saleEndsAt: new Date(now - 1) },
      start,
      "Asia/Kolkata",
      now,
    ).label,
  ).toBe("Sales closed");
  expect(
    ticketAvailability(
      { ...type, saleStartsAt: new Date(now), saleEndsAt: new Date(now) },
      start,
      "Asia/Kolkata",
      now,
    ).available,
  ).toBe(true);
});
it("encodes calendar dates in UTC with the event timezone and only the public link", () => {
  const url = new URL(
    eventCalendarUrl(
      {
        title: "Music & friends",
        startsAt: new Date(start),
        endsAt: new Date("2026-10-15T14:00:00Z"),
        timezone: "Asia/Kolkata",
        venueName: "Hall",
        address: "MG Road",
        city: "Pune",
      },
      "https://raunak.example/e/music",
    ),
  );
  expect(url.searchParams.get("dates")).toBe(
    "20261015T120000Z/20261015T140000Z",
  );
  expect(url.searchParams.get("ctz")).toBe("Asia/Kolkata");
  expect(url.searchParams.get("details")).toBe(
    "Event details: https://raunak.example/e/music",
  );
});
it("keeps QR ticket emails readable, escaped, and usable when images are blocked", () => {
  const html = emailMarkup(
    "Hello <script>bad</script>",
    {
      event_title: "Music & friends",
      ticket_code: "RN123",
      ticket_url: "https://raunak.example/t/private",
      order_id: "order",
      event_date: "15 October",
      event_time: "5 pm",
      quantity: "1",
      amount_paid: "₹500",
      ticket_type: "Guest",
    },
    true,
    "TICKET_ISSUED",
  );
  expect(html).toContain("cid:ticket-qr");
  expect(html).toContain("RN123");
  expect(html).toContain("Open my entry ticket");
  expect(html).not.toContain("<script>");
  expect(html).toContain("PDF ticket is attached");
  expect(
    emailMarkup(
      "Failed",
      { event_title: "Music", ticket_url: "javascript:alert(1)" },
      false,
      "PAYMENT_FAILED",
    ),
  ).not.toContain("Total paid");
  expect(
    emailMarkup(
      "Failed",
      { event_title: "Music", ticket_url: "javascript:alert(1)" },
      false,
      "PAYMENT_FAILED",
    ),
  ).toContain('href="#"');
});
