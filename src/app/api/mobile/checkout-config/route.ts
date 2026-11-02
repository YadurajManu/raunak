import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { z } from "zod";
import { resolveWhatsApp } from "@/server/whatsapp/routing";
import { resolvedTemplate } from "@/server/notifications/service";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    if (!(await currentUser()))
      return Response.json(
        { error: "Please sign in." },
        { status: 401, headers },
      );
    const id = z
      .uuid()
      .safeParse(new URL(request.url).searchParams.get("eventId"));
    if (!id.success)
      return Response.json(
        { error: "Event not found." },
        { status: 404, headers },
      );
    const event = await db.event.findFirst({
      where: {
        id: id.data,
        status: "PUBLISHED",
        isTest: false,
        deletedAt: null,
        org: { status: "ACTIVE" },
      },
      select: { id: true, orgId: true },
    });
    if (!event)
      return Response.json(
        { error: "Event is unavailable." },
        { status: 404, headers },
      );
    let whatsappAvailable = false;
    try {
      const route = await resolveWhatsApp(event.orgId);
      if (
        route.kind === "gateway" ||
        (process.env.WHATSAPP_CLOUD_TOKEN &&
          process.env.WHATSAPP_PHONE_NUMBER_ID)
      ) {
        const settings = await Promise.all(
          (["ORDER_CONFIRMED", "TICKET_ISSUED"] as const).map((trigger) =>
            resolvedTemplate(event.orgId, event.id, trigger, "WHATSAPP"),
          ),
        );
        whatsappAvailable = settings.some(
          (setting) => setting?.isEnabled !== false,
        );
      }
    } catch {
      /* Email booking remains available without WhatsApp. */
    }
    return Response.json({ whatsappAvailable }, { headers });
  } catch {
    return Response.json(
      { error: "Checkout settings could not be loaded." },
      { status: 503, headers },
    );
  }
}
