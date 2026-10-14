type SaleTicket = {
  quantityTotal: number;
  quantitySold: number;
  quantityHeld: number;
  minPerOrder: number;
  isHidden: boolean;
  saleStartsAt: string | Date | null;
  saleEndsAt: string | Date | null;
};
export function ticketAvailability(
  type: SaleTicket,
  startsAt: string | Date,
  timezone: string,
  now = Date.now(),
  eventStatus = "PUBLISHED",
) {
  const remaining = Math.max(
    0,
    type.quantityTotal - type.quantitySold - type.quantityHeld,
  );
  const date = (value: string | Date) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    }).format(new Date(value));
  if (eventStatus !== "PUBLISHED")
    return {
      available: false,
      label:
        eventStatus === "DRAFT"
          ? "Draft · publish to start selling"
          : "Event closed · booking unavailable",
      remaining,
    };
  if (type.isHidden)
    return { available: false, label: "Hidden from guests", remaining };
  if (new Date(startsAt).getTime() <= now)
    return {
      available: false,
      label: "Event started · booking closed",
      remaining,
    };
  if (type.saleEndsAt && new Date(type.saleEndsAt).getTime() < now)
    return { available: false, label: "Sales closed", remaining };
  if (type.saleStartsAt && new Date(type.saleStartsAt).getTime() > now)
    return {
      available: false,
      label: `Sales open ${date(type.saleStartsAt)}`,
      remaining,
    };
  if (remaining === 0)
    return {
      available: false,
      label:
        type.quantityHeld > 0
          ? "Tickets currently reserved · check again shortly"
          : "Sold out",
      remaining,
    };
  if (remaining < type.minPerOrder)
    return {
      available: false,
      label: `Not enough tickets for the minimum of ${type.minPerOrder}`,
      remaining,
    };
  return { available: true, label: "On sale now", remaining };
}
