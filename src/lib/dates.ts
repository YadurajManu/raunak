import { Temporal } from "@js-temporal/polyfill";

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
