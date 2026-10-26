export type EventLintIssue = { severity: "warning" | "error"; message: string };

const detailLine = /^\s*(date|time|location|venue)\s*:/im;
const dateLine = /^\s*date\s*:\s*(.+)$/im;
const timeLine = /^\s*time\s*:\s*(.+)$/im;
const endDateLine = /^\s*end(?:\s+date)?\s*:\s*(.+)$/im;
const endTimeLine = /^\s*end(?:\s+time)?\s*:\s*(.+)$/im;

function dateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function mentionsDateConflict(value: string, startsAt: Date, timezone: string) {
  const expected = dateParts(startsAt, timezone);
  const numeric = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  const named = value.match(
    /\b(?:(\d{1,2})\s+([a-z]{3,9})|(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?)\s+(\d{4})\b/i,
  );
  let day: string | undefined;
  let month: string | undefined;
  let rawYear: string | undefined;
  if (numeric) [, day, month, rawYear] = numeric;
  else if (named) {
    day = named[1] || named[4];
    month = named[2] || named[3];
    rawYear = named[5];
  }
  if (!day || !month || !rawYear) return false;
  const monthNumber = /^\d+$/.test(month)
    ? Number(month)
    : [
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
      ].indexOf(month.slice(0, 3).toLowerCase()) + 1;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return (
    Number(day) !== Number(expected.day) ||
    monthNumber !== Number(expected.month) ||
    Number(year) !== Number(expected.year)
  );
}

function mentionsTimeConflict(value: string, date: Date, timezone: string) {
  const explicit = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!explicit) return false;
  const actual = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .toLowerCase()
    .replace(/\s/g, "");
  const described = `${Number(explicit[1])}:${explicit[2] || "00"}${explicit[3].toLowerCase()}`;
  return actual !== described;
}

export function lintEvent(event: {
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  timezone?: string | null;
  venueName?: string | null;
  address?: string | null;
  published?: boolean;
  ticketTypes?: { name?: string | null }[];
  organizer?: { tagline?: string | null; logoKey?: string | null };
}): EventLintIssue[] {
  const description = event.description || "";
  const issues: EventLintIssue[] = [];
  if (detailLine.test(description)) {
    issues.push({
      severity: "warning",
      message:
        "These details are already shown on the page. Remove them from the description to avoid conflicts.",
    });
  }

  const hasVenue = Boolean(event.venueName?.trim() || event.address?.trim());
  const venueTba =
    /\b(?:venue|location)\b.{0,50}\b(?:to be announced|tba)\b/i.test(
      description,
    ) || /\b(?:to be announced|tba)\b.{0,50}\b(?:venue|location)\b/i.test(description);
  const dateValue = description.match(dateLine)?.[1] || "";
  const timeValue = description.match(timeLine)?.[1] || "";
  const endDateValue = description.match(endDateLine)?.[1] || "";
  const endTimeValue = description.match(endTimeLine)?.[1] || "";
  const dateConflict = dateValue
    ? mentionsDateConflict(
        dateValue,
        event.startsAt,
        event.timezone || "Asia/Kolkata",
      )
    : false;
  const timeConflict = timeValue
    ? mentionsTimeConflict(
        timeValue,
        event.startsAt,
        event.timezone || "Asia/Kolkata",
      )
    : false;
  const endDateConflict = Boolean(
    endDateValue &&
      event.endsAt &&
      mentionsDateConflict(
        endDateValue,
        event.endsAt,
        event.timezone || "Asia/Kolkata",
      ),
  );
  const endTimeConflict = Boolean(
    endTimeValue &&
      event.endsAt &&
      mentionsTimeConflict(
        endTimeValue,
        event.endsAt,
        event.timezone || "Asia/Kolkata",
      ),
  );
  if (
    dateConflict ||
    timeConflict ||
    endDateConflict ||
    endTimeConflict ||
    (venueTba && hasVenue)
  ) {
    issues.push({
      severity:
        event.published &&
        (dateConflict || endDateConflict || (venueTba && hasVenue))
          ? "error"
          : "warning",
      message:
        dateConflict || timeConflict || endDateConflict || endTimeConflict
          ? "The date or time in the description conflicts with the event details. Update one so guests see the correct information."
          : "The description says the venue is not announced, but a venue is already set. Update one so guests see the correct information.",
    });
  }
  if (
    /\b(?:ends?|until|till)\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(
      description,
    ) &&
    !event.endsAt
  ) {
    issues.push({
      severity: "warning",
      message:
        "The description mentions an end time, but no event end time is set.",
    });
  }
  if (
    event.ticketTypes?.some((type) =>
      /\p{Extended_Pictographic}/u.test(type.name || ""),
    )
  ) {
    issues.push({
      severity: "warning",
      message:
        "Emoji in ticket names can break on PDFs and WhatsApp cards. Use plain text.",
    });
  }
  if (
    event.organizer &&
    (Object.hasOwn(event.organizer, "tagline") ||
      Object.hasOwn(event.organizer, "logoKey")) &&
    (!event.organizer.tagline?.trim() || !event.organizer.logoKey)
  ) {
    issues.push({
      severity: "warning",
      message:
        "Complete the organizer profile with a tagline and logo to help guests recognize who is hosting.",
    });
  }
  return issues;
}
