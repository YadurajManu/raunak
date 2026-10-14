export function variantUrl(variants: unknown, size: string, format: "avif" | "webp" | "jpeg" = "jpeg"): string | null {
  if (!variants || typeof variants !== "object") return null;
  const urls = (variants as Record<string, Record<string, unknown>>)[size];
  const value = urls?.[format];
  return typeof value === "string" ? value : null;
}
