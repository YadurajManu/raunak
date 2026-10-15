export function calendarFile(
  event: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    venueName: string | null;
    address: string | null;
    city: string | null;
    id: string;
    description?: string | null;
    summary?: string | null;
  },
  url: string,
) {
  const escape = (v: string) =>
    v
      .replaceAll("\\", "\\\\")
      .replaceAll("\r", "")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const date = (v: Date) =>
    v
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Raunak//Events//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@raunak`,
    `DTSTAMP:${date(new Date())}`,
    `DTSTART:${date(event.startsAt)}`,
    `DTEND:${date(event.endsAt)}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape([event.description || event.summary, `Event details: ${url}`].filter(Boolean).join("\n\n"))}`,
    `LOCATION:${escape([event.venueName, event.address, event.city].filter(Boolean).join(", "))}`,
    `URL:${escape(url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return (
    lines
      .map((line) => {
        let result = "",
          bytes = 0;
        for (const char of line) {
          const length = new TextEncoder().encode(char).length;
          if (bytes + length > 73) {
            result += "\r\n ";
            bytes = 1;
          }
          result += char;
          bytes += length;
        }
        return result;
      })
      .join("\r\n") + "\r\n"
  );
}
