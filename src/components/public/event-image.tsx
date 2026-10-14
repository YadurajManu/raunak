import { variantUrl } from "@/lib/images";

export function EventImage({ variants, alt, size = "hero", className = "" }: { variants: unknown; alt: string; size?: "thumb" | "card" | "hero" | "og"; className?: string }) {
  const jpeg = variantUrl(variants, size, "jpeg");
  if (!jpeg) return <div className={`flex items-center justify-center bg-indigo-100 text-5xl text-indigo-300 dark:bg-zinc-800 ${className}`} aria-hidden="true">✦</div>;
  return <picture><source srcSet={variantUrl(variants, size, "avif") || undefined} type="image/avif" /><source srcSet={variantUrl(variants, size, "webp") || undefined} type="image/webp" /><img src={jpeg} alt={alt} loading={size === "hero" ? "eager" : "lazy"} className={className} /></picture>;
}
