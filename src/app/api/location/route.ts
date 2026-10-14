import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { lookupLocation } from "@/server/location/service";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    return Response.json({
      places: await lookupLocation(user.id, await request.json()),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Location lookup failed.",
      },
      { status: 400 },
    );
  }
}
