import { expect, it } from "vitest";
import { attendeeFilters, csvCell } from "@/lib/attendees";
it("quotes CSV values and neutralizes spreadsheet formulas", () => {
  expect(csvCell('hello,"there"')).toBe('"hello,""there"""');
  for (const value of [
    "=CMD()",
    "+919999999999",
    "-formula",
    "@import",
    "\t=bad",
    " =SUM(1,2)",
  ])
    expect(csvCell(value)).toBe(`"'${value}"`);
});
it("validates and scopes attendee filters", () => {
  expect(() => attendeeFilters("invalid")).toThrow();
  expect(() =>
    attendeeFilters("11111111-1111-4111-8111-111111111111", "", "BAD"),
  ).toThrow();
  expect(
    attendeeFilters("11111111-1111-4111-8111-111111111111", " guest ", "USED"),
  ).toMatchObject({
    status: "USED",
    eventId: "11111111-1111-4111-8111-111111111111",
  });
});
