import { Temporal } from "@js-temporal/polyfill";

export function updateLocalEventTimePart(
  value: string,
  part: "date" | "time",
  nextValue: string,
): string {
  const [date = "", time = ""] = value.split("T");
  const next = part === "date" ? [nextValue, time] : [date, nextValue];
  return next.some(Boolean) ? `${next[0]}T${next[1]}` : "";
}

export function localEventTimeToUtc(local: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(local)
    .toZonedDateTime(timeZone, { disambiguation: "reject" })
    .toInstant()
    .toString();
}

export function utcToLocalEventTime(utc: string, timeZone: string): string {
  return Temporal.Instant.from(utc)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
