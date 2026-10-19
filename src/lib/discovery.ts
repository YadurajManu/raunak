import { z } from "zod";
import { eventCategories } from "@/config/event-options";

const slugifyCategory = (value: string) =>
  value
    .toLocaleLowerCase("en-IN")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const categorySlugs: Record<string, string> = {
  "Music & nightlife": "music-nightlife",
  "Workshops & classes": "workshops-classes",
  "Meetups & networking": "meetups",
  "Arts & culture": "arts-culture",
  "Food & drink": "food-drink",
  "Sports & wellness": "sports-wellness",
  Conferences: "conferences",
  "Community & celebrations": "community-celebrations",
  Other: "other",
};
const categoryBySlug = new Map(
  Object.entries(categorySlugs).map(([category, slug]) => [slug, category]),
);
const slugByCategory = new Map(Object.entries(categorySlugs));

function parseCategories(value: string) {
  return (value.includes("|") ? value.split("|") : value.split(","))
    .map((item) => {
      const trimmed = item.trim();
      return (
        categoryBySlug.get(slugifyCategory(trimmed)) ||
        eventCategories.find(
          (category) =>
            category.toLocaleLowerCase("en-IN") ===
            trimmed.toLocaleLowerCase("en-IN"),
        ) ||
        trimmed
      );
    })
    .filter(Boolean)
    .slice(0, 12)
    .join("|");
}

function serializeCategories(value: string) {
  return (value.includes("|") ? value.split("|") : value.split(","))
    .map((item) => {
      const category = eventCategories.find(
        (value) => value.toLocaleLowerCase("en-IN") === item.trim().toLocaleLowerCase("en-IN"),
      );
      return category ? slugByCategory.get(category) : slugifyCategory(item.trim());
    })
    .filter(Boolean)
    .slice(0, 12)
    .join(",");
}

export const discoverySchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    city: z.string().trim().max(100).default(""),
    category: z.string().max(800).default(""),
    nearCity: z.string().trim().max(100).optional(),
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
  })
  .transform((v) => {
    const normalized = {
      ...v,
      category: parseCategories(v.category),
      nearCity: v.lat === undefined ? undefined : v.nearCity,
    };
    return v.mode === "ONLINE"
      ? {
          ...normalized,
          city: "",
          lat: undefined,
          lng: undefined,
          nearCity: undefined,
          radius: 25,
        }
      : normalized;
  });
export type DiscoveryFilters = z.infer<typeof discoverySchema>;
/** Human-readable applied constraints, without exposing precise coordinates. */
export function discoveryFilterLabels(f: DiscoveryFilters): string[] {
  const labels: string[] = [];
  if (f.q) labels.push(`Search: ${f.q}`);
  labels.push(...f.category.split("|").filter(Boolean));
  if (f.city) labels.push(f.city);
  if (f.lat !== undefined)
    labels.push(`${f.nearCity || "Nearby"} · ${f.radius} km`);
  if (f.period)
    labels.push(
      {
        today: "Today",
        tomorrow: "Tomorrow",
        weekend: "This weekend",
        month: "This month",
      }[f.period],
    );
  if (!f.period && f.from) labels.push(`From ${f.from}`);
  if (!f.period && f.to) labels.push(`Until ${f.to}`);
  if (f.mode)
    labels.push(
      { ONLINE: "Online", IN_PERSON: "In person", HYBRID: "Hybrid" }[f.mode],
    );
  if (f.price) labels.push(f.price === "free" ? "Free" : "Paid");
  if (f.min !== undefined)
    labels.push(`From ₹${f.min.toLocaleString("en-IN")}`);
  if (f.max !== undefined)
    labels.push(`Up to ₹${f.max.toLocaleString("en-IN")}`);
  if (f.organizer) labels.push(`Organizer: ${f.organizer}`);
  return labels;
}
export function discoveryUrl(
  filters: Record<string, unknown>,
  changes: Record<string, unknown> = {},
) {
  const query = new URLSearchParams();
  const values: Record<string, unknown> = {
    ...filters,
    page: undefined,
    ...changes,
  };
  if (typeof values.category === "string" && values.category)
    values.category = serializeCategories(values.category);
  if (values.mode === "ONLINE") {
    values.city = "";
    values.lat = undefined;
    values.lng = undefined;
    values.nearCity = undefined;
  }
  if (values.lat === undefined) values.radius = undefined;
  for (const [key, value] of Object.entries(values))
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(key === "sort" && value === "soonest")
    )
      query.set(key, String(value));
  return `/discover${query.size ? `?${query}` : ""}`;
}
