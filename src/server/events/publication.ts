import { lintEvent } from "@/lib/event-description-lint";

type PublishableEvent = {
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  mode: string;
  city: string | null;
  address: string | null;
  venueName: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  ticketTypes: { quantityTotal: number }[];
  images: { variants: unknown }[];
  timezone?: string;
};

export function assertEventCanBePublished(event: PublishableEvent) {
  if (event.startsAt <= new Date())
    throw new Error("Event start must be in the future.");
  if (event.endsAt <= event.startsAt)
    throw new Error("Event end must be after its start.");
  if (
    event.mode !== "ONLINE" &&
    (!event.city || !(event.address || event.venueName))
  )
    throw new Error("Add a city and venue or address before publishing.");
  if (event.mode !== "IN_PERSON" && !event.onlineUrl)
    throw new Error("Add the online joining link before publishing.");
  if (!event.ticketTypes.length)
    throw new Error("Add a ticket type before publishing.");
  if (
    event.capacity &&
    event.ticketTypes.reduce((sum, type) => sum + type.quantityTotal, 0) >
      event.capacity
  )
    throw new Error("Ticket inventory exceeds event capacity.");
  if (!event.images.length || !event.images[0].variants)
    throw new Error("Add a processed poster before publishing.");
  const contentError = lintEvent({
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    venueName: event.venueName,
    address: event.address,
    published: true,
  }).find((issue) => issue.severity === "error");
  if (contentError) throw new Error(contentError.message);
}
