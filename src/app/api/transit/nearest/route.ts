import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import IORedis from "ioredis";
import { requireUser } from "@/server/auth/session";
import { getNearestStations } from "@/server/transit/overpass";

// Redis client with fallback for rate limiting & caching
const globalRedis = globalThis as unknown as { transitRedis?: IORedis };
const redis =
  globalRedis.transitRedis ??
  new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
globalRedis.transitRedis = redis;

// In-memory fallback cache and rate-limit map if redis is down
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();
const memoryRateLimit = new Map<string, { count: number; expiresAt: number }>();

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

async function checkRateLimit(userId: string): Promise<boolean> {
  const key = `transit-rate:${userId}`;
  try {
    const count = Number(
      await redis.eval(
        'local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],60) end; return n',
        1,
        key,
      ),
    );
    return count <= 30;
  } catch {
    // Memory fallback
    const now = Date.now();
    const entry = memoryRateLimit.get(key);
    if (!entry || entry.expiresAt < now) {
      memoryRateLimit.set(key, { count: 1, expiresAt: now + 60000 });
      return true;
    }
    entry.count += 1;
    return entry.count <= 30;
  }
}

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (raw) return JSON.parse(raw);
  } catch {
    const entry = memoryCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value as T;
    }
  }
  return null;
}

async function setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const isAllowed = await checkRateLimit(user.id);
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Too many transit requests. Please try again in a minute." },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      lat: searchParams.get("lat"),
      lng: searchParams.get("lng"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid coordinates provided." },
        { status: 400 },
      );
    }

    const { lat, lng } = parsed.data;
    // Cache key rounded to ~11 meters precision (4 decimals)
    const cacheKey = `transit:nearest:${lat.toFixed(4)}:${lng.toFixed(4)}`;
    const cached = await getCached<unknown>(cacheKey);
    if (cached) {
      return NextResponse.json({ stations: cached });
    }

    const stations = await getNearestStations(lat, lng, 3);
    // Cache for 24 hours
    await setCached(cacheKey, stations, 86400);

    return NextResponse.json({ stations });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to find nearby transit.";
    if (errorMessage === "Authentication required.") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
