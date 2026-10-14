import { z } from "zod";
import IORedis from "ioredis";
const globalRedis = globalThis as unknown as { locationRedis?: IORedis };
const redis =
  globalRedis.locationRedis ??
  new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
globalRedis.locationRedis = redis;
export const lookupSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("search"),
    query: z.string().trim().min(3).max(200),
  }),
  z.object({
    kind: z.literal("reverse"),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
]);
const responseSchema = z.object({
  results: z.array(
    z.object({
      formatted: z.string(),
      lat: z.number(),
      lon: z.number(),
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      suburb: z.string().optional(),
      county: z.string().optional(),
      state: z.string().optional(),
      country_code: z.string(),
    }),
  ),
});
export type Place = {
  city: string;
  region: string;
  countryCode: string;
  label: string;
  latitude: number;
  longitude: number;
};
export async function lookupLocation(
  userId: string,
  input: unknown,
  request: typeof fetch = fetch,
): Promise<Place[]> {
  z.uuid().parse(userId);
  const data = lookupSchema.parse(input);
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey)
    throw new Error(
      "Address search is not configured. You can enter your city manually.",
    );
  const count = Number(
    await redis.eval(
      'local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],60) end; return n',
      1,
      `location-rate:${userId}`,
    ),
  );
  if (count > 30)
    throw new Error("Too many location requests. Try again in a minute.");
  const url = new URL(
    `https://api.geoapify.com/v1/geocode/${data.kind === "search" ? "search" : "reverse"}`,
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "en");
  url.searchParams.set("limit", data.kind === "search" ? "5" : "1");
  if (data.kind === "search") {
    url.searchParams.set("text", data.query);
    url.searchParams.set("bias", "countrycode:in");
  } else {
    url.searchParams.set("lat", String(data.latitude));
    url.searchParams.set("lon", String(data.longitude));
  }
  const response = await request(url, {
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      "Address lookup is unavailable. Adjust the pin or enter your city manually.",
    );
  return responseSchema
    .parse(await response.json())
    .results.map((place) => ({
      city:
        place.city ||
        place.town ||
        place.village ||
        place.suburb ||
        place.county ||
        "",
      region: place.state || "",
      countryCode: place.country_code.toUpperCase(),
      label: place.formatted,
      latitude: place.lat,
      longitude: place.lon,
    }));
}
