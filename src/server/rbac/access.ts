import type { OrgRole } from "@/generated/prisma/enums";
import { db } from "@/server/db/client";
import { z } from "zod";

export async function requireOrgRoleForUser(userId: string, orgId: string, roles: OrgRole[]) {
  z.uuid().parse(orgId);
  const membership = await db.organizationMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
  if (!membership || membership.status !== "ACTIVE" || !roles.includes(membership.role)) throw new Error("Access denied.");
  return membership;
}

export async function requireEventAccessForUser(userId: string, eventId: string, roles: OrgRole[]) {
  z.uuid().parse(eventId);
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, orgId: true, deletedAt: true } });
  if (!event || event.deletedAt) throw new Error("Event not found.");
  const membership = await db.organizationMember.findUnique({ where: { orgId_userId: { orgId: event.orgId, userId } } });
  if (!membership || membership.status !== "ACTIVE" || !roles.includes(membership.role)) throw new Error("Access denied.");
  if (membership.role === "MANAGER" || membership.role === "CHECKIN") {
    const assignment = await db.eventStaff.findUnique({ where: { eventId_userId: { eventId, userId } } });
    if (!assignment || assignment.role !== membership.role) throw new Error("Access denied.");
  }
  return event;
}
