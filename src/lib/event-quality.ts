import { eventCategories } from "@/config/event-options";
export function eventQuality(event: {
  title: string;
  category: string | null;
  summary: string | null;
  mode: string;
  city: string | null;
  venueName: string | null;
  address: string | null;
  onlineUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  ticketTypes: unknown[];
  images: {
    kind: string;
    width?: number | null;
    height?: number | null;
    variants: unknown;
  }[];
  org: {
    name: string;
    supportEmail: string | null;
    supportPhone: string | null;
  };
}) {
  const warnings: string[] = [];
  const cover = event.images.find((v) => v.kind === "COVER");
  const poster = event.images.find((v) => v.kind === "POSTER");
  if (!cover?.variants)
    warnings.push(
      "Add a processed cover image for a stronger event header. Your poster can still be used.",
    );
  if (
    cover?.width &&
    cover.height &&
    (cover.width / cover.height < 1.3 || cover.width / cover.height > 2.2)
  )
    warnings.push(
      "The cover has an unusual ratio. Preview its crop on desktop and mobile.",
    );
  if (
    poster?.width &&
    poster.height &&
    (poster.width / poster.height < 0.65 || poster.width / poster.height > 1.2)
  )
    warnings.push(
      "Review the poster crop; a 4:5 image works well in discovery.",
    );
  if (event.title.trim().length < 8)
    warnings.push(
      "Consider a more descriptive title so guests understand the event.",
    );
  if (!event.summary)
    warnings.push("Add a short summary to help guests decide.");
  if (!event.category || !eventCategories.includes(event.category))
    warnings.push(
      "Choose or review the category. Make sure it matches the actual experience.",
    );
  if (
    !event.org.name.trim() ||
    (!event.org.supportEmail && !event.org.supportPhone)
  )
    warnings.push(
      "Add organizer contact details so guests know how to get help.",
    );
  if (
    event.mode !== "ONLINE" &&
    (!event.city || !(event.address || event.venueName))
  )
    warnings.push("Add a city and venue/address before publishing.");
  if (event.mode !== "IN_PERSON" && !event.onlineUrl)
    warnings.push("Add the online joining link before publishing.");
  return warnings;
}
