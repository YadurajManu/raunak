import { Temporal } from "@js-temporal/polyfill";
export const dateChoices = ["today", "tomorrow", "weekend", "month"] as const;
export function discoveryDates(period?: string, from?: string, now = new Date()) {
  const today = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO("Asia/Kolkata").toPlainDate();
  let start = from ? Temporal.PlainDate.from(from) : today;
  let end: Temporal.PlainDate | undefined;
  if (period === "today") { start = today; end = today.add({ days: 1 }); }
  if (period === "tomorrow") { start = today.add({ days: 1 }); end = start.add({ days: 1 }); }
  if (period === "weekend") { start = today.add({ days: today.dayOfWeek === 7 ? 0 : Math.max(0, 6 - today.dayOfWeek) }); end = start.add({ days: start.dayOfWeek === 7 ? 1 : 2 }); }
  if (period === "month") { start = today; end = today.with({ day: 1 }).add({ months: 1 }); }
  const midnight = (date: Temporal.PlainDate) => new Date(date.toZonedDateTime({ timeZone: "Asia/Kolkata", plainTime: "00:00" }).epochMilliseconds);
  return { gte: from && !period ? midnight(start) : new Date(Math.max(now.getTime(), midnight(start).getTime())), ...(end ? { lt: midnight(end) } : {}) };
}
