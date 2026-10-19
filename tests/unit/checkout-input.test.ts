import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  checkoutInputSchema,
  orderedAttendeeNames,
} from "@/server/checkout/input";

const cart = () => ({
  eventId: randomUUID(),
  items: [{ ticketTypeId: randomUUID(), quantity: 2 }],
  buyerName: "Test attendee",
  idempotencyKey: randomUUID(),
});
describe("checkout details", () => {
  it("normalizes Indian and international phones and permits email-only free details", () => {
    expect(checkoutInputSchema.parse(cart()).buyerPhone).toBeNull();
    expect(
      checkoutInputSchema.parse({ ...cart(), buyerPhone: "98765 43210" })
        .buyerPhone,
    ).toBe("+919876543210");
    expect(
      checkoutInputSchema.parse({ ...cart(), buyerPhone: "+44 7911 123456" })
        .buyerPhone,
    ).toBe("+447911123456");
  });
  it("requires phone for consent and validates complete attendee names", () => {
    expect(
      checkoutInputSchema.safeParse({ ...cart(), whatsappOptIn: true }).success,
    ).toBe(false);
    expect(
      checkoutInputSchema.safeParse({
        ...cart(),
        attendeeNames: ["One person"],
      }).success,
    ).toBe(false);
    expect(
      checkoutInputSchema.safeParse({
        ...cart(),
        attendeeNames: ["One person", "Second person"],
      }).success,
    ).toBe(true);
    const duplicate = cart();
    duplicate.items.push(duplicate.items[0]);
    expect(checkoutInputSchema.safeParse(duplicate).success).toBe(false);
  });
  it("keeps attendee names attached to ticket types after database relation ordering", () => {
    expect(
      orderedAttendeeNames({
        items: [
          { ticketTypeId: "b", quantity: 2 },
          { ticketTypeId: "a", quantity: 1 },
        ],
        attendeeNames: ["B one", "B two", "A one"],
      }),
    ).toEqual(["A one", "B one", "B two"]);
  });
});
