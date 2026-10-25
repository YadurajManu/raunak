import { expect, it } from "vitest";
import {
  renderTemplate,
  escapeHtml,
  defaultBodies,
  validateBroadcastBody,
} from "@/server/notifications/templates";
it("renders only approved variables and escapes email HTML", () => {
  expect(
    renderTemplate("Hi {{ attendee_name }}", { attendee_name: "Riya" }),
  ).toBe("Hi Riya");
  expect(() => renderTemplate("{{process.env}}", {})).toThrow(
    "Unsupported variable",
  );
  expect(escapeHtml('<img src=x onerror="x">')).toBe(
    "&lt;img src=x onerror=&quot;x&quot;&gt;",
  );
});
it("limits attendee broadcasts to event and attendee details, excluding private ticket variables", () => {
  expect(
    validateBroadcastBody(
      "Hi {{attendee_name}} — {{event_title}} is at {{venue}}. {{event_url}}",
    ),
  ).toContain("{{event_url}}");
  expect(() =>
    validateBroadcastBody("Your private QR is {{ticket_url}}"),
  ).toThrow("Use only attendee and event details");
});
it("includes real event, organizer, booking and support details in branded ticket messages", () => {
  const values = {
    attendee_name: "Riya",
    event_title: "Arts evening",
    event_date: "24 October 2026",
    event_time: "6:00 pm IST",
    venue: "Gallery, MG Road",
    city: "Pune",
    organizer_name: "Arts Collective",
    ticket_type: "Admission",
    ticket_code: "ABC123",
    quantity: "2",
    amount_paid: "₹500",
    order_id: "booking-123",
    ticket_url: "https://example.test/private-ticket",
    support_contact: "support@example.test",
  };
  for (const trigger of ["ORDER_CONFIRMED", "TICKET_ISSUED"] as const) {
    const message = renderTemplate(defaultBodies[trigger], values);
    for (const detail of [
      "Raunak",
      values.event_title,
      values.event_time,
      values.venue,
      values.organizer_name,
      values.ticket_url,
      values.support_contact,
    ])
      expect(message).toContain(detail);
    expect(message.split(values.ticket_url)).toHaveLength(2);
    expect(message).not.toContain("{{");
  }
});
