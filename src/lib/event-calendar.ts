export function eventCalendarUrl(
  event: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    venueName: string | null;
    address: string | null;
    city: string | null;
  },
  url: string,
) {
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: event.title, dates: `${stamp(event.startsAt)}/${stamp(event.endsAt)}`, ctz: event.timezone, location: [event.venueName, event.address, event.city].filter(Boolean).join(", "), details: `Event details: ${url}` })}`;
}
