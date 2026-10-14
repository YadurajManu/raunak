import { z } from "zod";
export function attendeeFilters(eventId: string, q = "", status = "") {
  z.uuid().parse(eventId);
  const search = z.string().trim().max(100).parse(q);
  const state = z
    .enum(["", "VALID", "USED", "CANCELLED", "REFUNDED"])
    .parse(status);
  return {
    eventId,
    ...(state ? { status: state } : {}),
    ...(search
      ? {
          OR: [
            { holderName: { contains: search, mode: "insensitive" as const } },
            { holderEmail: { contains: search, mode: "insensitive" as const } },
            { holderPhone: { contains: search } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[=+\-@]/.test(text.trimStart()) || /^[\t\r\n]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
}
