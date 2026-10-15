export function eventCalendarUrl(
  event: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    venueName: string | null;
    address: string | null;
    city: string | null;
    description?: string | null;
    summary?: string | null;
  },
  url: string,
) {
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: event.title, dates: `${stamp(event.startsAt)}/${stamp(event.endsAt)}`, ctz: event.timezone, location: [event.venueName, event.address, event.city].filter(Boolean).join(", "), details: [event.description || event.summary, `Event details: ${url}`].filter(Boolean).join("\n\n") })}`;
}

export function eventCalendarOptions(
  event: Parameters<typeof eventCalendarUrl>[0],
  url: string,
) {
  if (
    !event.title.trim() ||
    !Number.isFinite(event.startsAt.getTime()) ||
    !Number.isFinite(event.endsAt.getTime()) ||
    event.endsAt <= event.startsAt
  )
    return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: event.timezone }).format(
      event.startsAt,
    );
    const publicUrl = new URL(url);
    if (
      !["https:", "http:"].includes(publicUrl.protocol) ||
      !publicUrl.pathname.startsWith("/e/")
    )
      return null;
  } catch {
    return null;
  }
  return {
    google: eventCalendarUrl(event, url),
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${new URLSearchParams(
      {
        path: "/calendar/action/compose",
        rru: "addevent",
        subject: event.title,
        startdt: event.startsAt.toISOString(),
        enddt: event.endsAt.toISOString(),
        location: [event.venueName, event.address, event.city]
          .filter(Boolean)
          .join(", "),
        body: [event.description || event.summary, `Event details: ${url}`]
          .filter(Boolean)
          .join("\n\n"),
      },
    )}`,
  };
}
