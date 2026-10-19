import { requireSameOrigin } from "@/server/auth/origin";
import { lookupPublicCity } from "@/server/location/service";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
    return Response.json({
      city: await lookupPublicCity(await request.json(), clientIp),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nearby city lookup failed.";
    return Response.json(
      { error: message },
      { status: message.startsWith("Too many") ? 429 : 400 },
    );
  }
}
