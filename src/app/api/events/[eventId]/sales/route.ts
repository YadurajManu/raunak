import { z } from "zod";
import { db } from "@/server/db/client";
import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { requireEventAccessForUser } from "@/server/rbac/access";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId } = await params;
    const access = await requireEventAccessForUser(user.id, eventId, [
      "OWNER",
      "ADMIN",
      "MANAGER",
    ]);
    const { paused } = z
      .object({ paused: z.boolean() })
      .parse(await request.json());
    const event = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
      const updated = await tx.event.update({
        where: { id: eventId },
        data: { salesPaused: paused },
      });
      await tx.auditLog.create({
        data: {
          orgId: access.orgId,
          actorId: user.id,
          action: paused ? "event.sales_paused" : "event.sales_resumed",
          entityType: "Event",
          entityId: eventId,
        },
      });
      return updated;
    });
    return Response.json({ paused: event.salesPaused });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not change sales.",
      },
      { status: 400 },
    );
  }
}
