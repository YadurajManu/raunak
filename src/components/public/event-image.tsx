import { variantUrl } from "@/lib/images";

export function EventImage({
  variants,
  alt,
  size = "hero",
  className = "",
  backdrop = false,
}: {
  variants: unknown;
  alt: string;
  size?: "thumb" | "card" | "hero" | "og";
  className?: string;
  backdrop?: boolean;
}) {
  const jpeg = variantUrl(variants, size, "jpeg");
  const widths = { thumb: 320, card: 640, hero: 1280 } as const;
  const srcSet = (format: "jpeg" | "webp" | "avif") =>
    (Object.entries(widths) as [keyof typeof widths, number][])
      .flatMap(([key, width]) => {
        const url = variantUrl(variants, key, format);
        return url ? [`${url} ${width}w`] : [];
      })
      .join(", ") || undefined;
  const sizes =
    size === "thumb"
      ? "110px"
      : size === "card"
        ? "(max-width: 640px) 100vw, (max-width: 1050px) 50vw, 33vw"
        : "(max-width: 1152px) 100vw, 1152px";
  if (!jpeg)
    return (
      <div
        className={`flex items-center justify-center r-image-placeholder text-5xl ${className}`}
        aria-hidden="true"
      >
        ✦
      </div>
    );
  const picture = (
    <picture>
      <source srcSet={srcSet("avif")} sizes={sizes} type="image/avif" />
      <source srcSet={srcSet("webp")} sizes={sizes} type="image/webp" />
      <img
        src={jpeg}
        srcSet={srcSet("jpeg")}
        sizes={sizes}
        decoding="async"
        alt={alt}
        loading={size === "hero" ? "eager" : "lazy"}
        className={className}
      />
    </picture>
  );
  return backdrop ? <span className="event-image-fit"><img className="event-image-backdrop" src={jpeg} alt="" aria-hidden="true" loading="lazy" />{picture}</span> : picture;
}
