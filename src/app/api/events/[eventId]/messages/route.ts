import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import {
  saveMessageTemplate,
  retryNotification,
} from "@/server/notifications/service";
import {
  resetMessageTemplate,
  sendMessageTest,
} from "@/server/notifications/editor";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId } = await params;
    const input = z
      .object({
        action: z.enum(["save", "reset", "retry", "test"]),
        payload: z.unknown(),
      })
      .parse(await request.json());
    if (input.action === "save")
      await saveMessageTemplate(user.id, eventId, input.payload);
    if (input.action === "reset")
      await resetMessageTemplate(user.id, eventId, input.payload);
    if (input.action === "test")
      await sendMessageTest(user.id, eventId, input.payload);
    if (input.action === "retry")
      await retryNotification(
        user.id,
        eventId,
        z.object({ id: z.uuid() }).parse(input.payload).id,
      );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update messages.",
      },
      { status: 400 },
    );
  }
}
