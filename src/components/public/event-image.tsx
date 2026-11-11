"use client";

import { useState } from "react";
import styles from "./event-image.module.css";
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
  const [settledSrc, setSettledSrc] = useState<string | null>(null);
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
        className={`${styles.placeholder} ${styles.loading} r-image-placeholder ${className}`}
        aria-hidden="true"
      />
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
        className={`${className} ${settledSrc === jpeg ? "" : styles.loading}`}
        ref={(node) => {
          if (node?.complete) setSettledSrc(jpeg);
        }}
        onLoad={() => setSettledSrc(jpeg)}
        onError={() => setSettledSrc(jpeg)}
      />
    </picture>
  );
  return backdrop ? (
    <span className="event-image-fit">
      <img
        className="event-image-backdrop"
        src={jpeg}
        alt=""
        aria-hidden="true"
        loading="lazy"
      />
      {picture}
    </span>
  ) : (
    picture
  );
}
