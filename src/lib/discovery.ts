import { z } from "zod";
export const discoverySchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    city: z.string().trim().max(100).default(""),
    category: z.string().max(800).default(""),
    period: z.enum(["", "today", "tomorrow", "weekend", "month"]).default(""),
    from: z.union([z.literal(""), z.iso.date()]).default(""),
    to: z.union([z.literal(""), z.iso.date()]).default(""),
    mode: z.enum(["", "ONLINE", "IN_PERSON", "HYBRID"]).default(""),
    price: z.enum(["", "free", "paid"]).default(""),
    min: z.coerce.number().min(0).max(1000000).optional(),
    max: z.coerce.number().min(0).max(1000000).optional(),
    sort: z
      .enum(["soonest", "newest", "price", "price-desc"])
      .default("soonest"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(1).max(200).default(25),
    organizer: z.string().max(100).optional(),
  })
  .refine((v) => !v.from || !v.to || v.to >= v.from, {
    message: "End date must be on or after the start date.",
  })
  .refine((v) => v.min === undefined || v.max === undefined || v.max >= v.min, {
    message: "Maximum price must be at least the minimum.",
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: "Choose a location before using nearby discovery.",
  });
export type DiscoveryFilters = z.infer<typeof discoverySchema>;
export function discoveryUrl(
  filters: Record<string, unknown>,
  changes: Record<string, unknown> = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({
    ...filters,
    page: undefined,
    ...changes,
  }))
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(key === "sort" && value === "soonest")
    )
      query.set(key, String(value));
  return `/discover${query.size ? `?${query}` : ""}`;
}
