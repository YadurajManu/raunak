import { z } from "zod";
import { WaError } from "@raunak/wa-contracts";
import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { saveMessageTemplate, retryNotification } from "./service";
import { resetMessageTemplate, sendMessageTest } from "./editor";
import { waErrorMessages } from "@/lib/whatsapp";
export async function messageActionResponse(request: Request, eventId: string | null, orgId?: string) {
  try {
    requireSameOrigin(request); const user = await requireUser();
    const input = z.object({ action: z.enum(["save", "reset", "retry", "test"]), payload: z.unknown() }).parse(await request.json());
    if (input.action === "save") await saveMessageTemplate(user.id, eventId, input.payload, orgId);
    if (input.action === "reset") await resetMessageTemplate(user.id, eventId, input.payload, orgId);
    if (input.action === "test") await sendMessageTest(user.id, eventId, input.payload, orgId);
    if (input.action === "retry") await retryNotification(user.id, eventId, z.object({ id: z.uuid() }).parse(input.payload).id, orgId);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "Authentication required." ? 401 : message === "Access denied." ? 403 : 400;
    return Response.json({ error: error instanceof WaError ? waErrorMessages[error.code] : error instanceof z.ZodError ? "Check your message settings and attachment options." : /^(Add |Create an event|Please wait|Use a paid order|Unsupported variable:|No approved WhatsApp template|Access denied|Authentication required|Failed delivery not found)/.test(message) ? message.slice(0, 200) : "Could not update messages. Check your connection and try again." }, { status });
  }
}
