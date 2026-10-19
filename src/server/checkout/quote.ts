import { db } from "@/server/db/client";
import { checkoutSelectionSchema } from "./input";

export async function quoteCheckout(input: unknown) {
  const data = checkoutSelectionSchema.parse(input);
  const now = new Date();
  const event = await db.event.findFirst({
    where: {
      id: data.eventId,
      status: "PUBLISHED",
      isTest: false,
      deletedAt: null,
      startsAt: { gt: now },
      org: { status: "ACTIVE" },
    },
    include: { org: true, ticketTypes: true },
  });
  if (!event) throw new Error("Event is unavailable.");
  const quantity = data.items.reduce((sum, line) => sum + line.quantity, 0);
  const used = event.ticketTypes.reduce(
    (sum, type) => sum + type.quantitySold + type.quantityHeld,
    0,
  );
  if (event.capacity !== null && used + quantity > event.capacity)
    throw new Error("Event capacity reached.");
  const items = data.items.map((line) => {
    const type = event.ticketTypes.find(
      (type) => type.id === line.ticketTypeId,
    );
    if (!type || type.isHidden) throw new Error("Ticket type is unavailable.");
    if (
      (type.saleStartsAt && type.saleStartsAt > now) ||
      (type.saleEndsAt && type.saleEndsAt < now)
    )
      throw new Error(`${type.name} is not on sale.`);
    if (line.quantity < type.minPerOrder || line.quantity > type.maxPerOrder)
      throw new Error(
        `Quantity for ${type.name} is outside the allowed range.`,
      );
    const available =
      type.quantityTotal - type.quantitySold - type.quantityHeld;
    if (available < line.quantity)
      throw new Error(
        `${type.name} has only ${Math.max(0, available)} tickets left.`,
      );
    return {
      ticketTypeId: type.id,
      name: type.name,
      quantity: line.quantity,
      unitPricePaise: type.pricePaise,
      lineTotalPaise: type.pricePaise * line.quantity,
      available,
      minPerOrder: type.minPerOrder,
      maxPerOrder: type.maxPerOrder,
    };
  });
  const subtotalPaise = items.reduce(
    (sum, line) => sum + line.lineTotalPaise,
    0,
  );
  const feePaise =
    subtotalPaise && event.org.feeMode === "PASS_TO_BUYER"
      ? Math.round((subtotalPaise * event.org.platformFeeBps) / 10000) +
        event.org.platformFeeFixedPaise * quantity
      : 0;
  const totalPaise = subtotalPaise + feePaise;
  if (totalPaise > 0 && totalPaise < 100)
    throw new Error("Paid bookings must total at least ₹1.");
  return { items, quantity, subtotalPaise, feePaise, totalPaise };
}
