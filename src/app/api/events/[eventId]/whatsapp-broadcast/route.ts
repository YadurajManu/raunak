import { z } from "zod";
import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { sendEventWhatsAppBroadcast } from "@/server/notifications/broadcast";
import { WaError } from "@raunak/wa-contracts";
import { waErrorMessages } from "@/lib/whatsapp";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId } = await params;
    const result = await sendEventWhatsAppBroadcast(
      user.id,
      eventId,
      await request.json(),
    );
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "Authentication required."
      ? 401
      : message === "Access denied."
        ? 403
        : error instanceof z.ZodError || message === "Request origin is not allowed."
          ? 400
          : 422;
    return Response.json(
      {
        error: error instanceof z.ZodError
          ? "Check the message and try again."
          : error instanceof WaError
            ? waErrorMessages[error.code]
          : /^(Choose |Only |No paid |Please wait |Use only |The linked )/.test(message)
            ? message
            : "Could not queue WhatsApp messages. Check the connection and retry.",
      },
      { status },
    );
  }
}
