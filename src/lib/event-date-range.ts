function dateKey(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(value);
}

function dateLabel(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(value);
}

function timeLabel(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  })
    .format(value)
    .replace(/\s/g, " ")
    .toLowerCase();
}

function durationLabel(milliseconds: number) {
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${remainder} min`;
}

export function formatEventDateRange(
  startsAt: Date | string,
  endsAt: Date | string,
  timezone: string,
) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const zone = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    timeZoneName: "short",
  })
    .formatToParts(start)
    .find((part) => part.type === "timeZoneName")?.value;
  const sameDay = dateKey(start, timezone) === dateKey(end, timezone);

  return {
    primary: `${dateLabel(start, timezone)} · ${timeLabel(start, timezone)} – ${timeLabel(end, timezone)}${zone ? ` ${zone}` : ""}`,
    secondary: sameDay
      ? null
      : `Ends ${dateLabel(end, timezone)} · ${durationLabel(end.getTime() - start.getTime())}`,
  };
}
