import { z } from "zod";
import { db } from "@/server/db/client";
import {
  requireEventAccessForUser,
  requireOrgRoleForUser,
} from "@/server/rbac/access";

export async function assignEventStaff(
  actorId: string,
  eventId: string,
  input: unknown,
) {
  const { userId } = z.object({ userId: z.uuid() }).parse(input);
  const event = await requireEventAccessForUser(actorId, eventId, [
    "OWNER",
    "ADMIN",
  ]);
  await requireOrgRoleForUser(actorId, event.orgId, ["OWNER", "ADMIN"]);
  const member = await db.organizationMember.findUnique({
    where: { orgId_userId: { orgId: event.orgId, userId } },
  });
  if (
    !member ||
    member.status !== "ACTIVE" ||
    (member.role !== "MANAGER" && member.role !== "CHECKIN")
  )
    throw new Error("Select an active Event Manager or Check-in Staff member.");
  const assignment = await db.eventStaff.upsert({
    where: { eventId_userId: { eventId, userId } },
    update: { role: member.role },
    create: { eventId, userId, role: member.role },
  });
  await db.auditLog.create({
    data: {
      orgId: event.orgId,
      actorId,
      action: "event.staff_assigned",
      entityType: "EventStaff",
      entityId: userId,
      meta: { eventId },
    },
  });
  return assignment;
}

export async function unassignEventStaff(
  actorId: string,
  eventId: string,
  userId: string,
) {
  z.uuid().parse(userId);
  const event = await requireEventAccessForUser(actorId, eventId, [
    "OWNER",
    "ADMIN",
  ]);
  const assignment = await db.eventStaff.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!assignment) throw new Error("Assignment not found.");
  await db.eventStaff.delete({
    where: { eventId_userId: { eventId, userId } },
  });
  await db.auditLog.create({
    data: {
      orgId: event.orgId,
      actorId,
      action: "event.staff_unassigned",
      entityType: "EventStaff",
      entityId: userId,
      meta: { eventId },
    },
  });
}
