import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { changeEventStatus } from "@/server/events/service";
import { z } from "zod";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId } = await params;
    const { status } = z
      .object({ status: z.string() })
      .parse(await request.json());
    return Response.json(await changeEventStatus(user.id, eventId, status));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not change event status.",
      },
      { status: 400 },
    );
  }
}
