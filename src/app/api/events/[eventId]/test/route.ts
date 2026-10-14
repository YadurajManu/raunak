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
    const { isTest } = z
      .object({ isTest: z.boolean() })
      .parse(await request.json());
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
      if (
        isTest &&
        (await tx.order.count({
          where: { eventId, status: { in: ["PAID", "PENDING"] } },
        }))
      )
        throw new Error(
          "An event with active bookings cannot be hidden as a test.",
        );
      await tx.event.update({ where: { id: eventId }, data: { isTest } });
      await tx.auditLog.create({
        data: {
          orgId: access.orgId,
          actorId: user.id,
          action: "event.test_status_updated",
          entityType: "Event",
          entityId: eventId,
          meta: { isTest },
        },
      });
    });
    return Response.json({ isTest });
  } catch {
    return Response.json(
      {
        error:
          "Could not change test status. Check permissions and active bookings.",
      },
      { status: 400 },
    );
  }
}
