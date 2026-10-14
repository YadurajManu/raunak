import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { createEvent } from "@/server/events/service";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const body = await request.json();
    const orgId = z.uuid().parse(body.orgId);
    return Response.json(await createEvent(user.id, orgId, body), {
      status: 201,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create event.",
      },
      { status: 400 },
    );
  }
}
