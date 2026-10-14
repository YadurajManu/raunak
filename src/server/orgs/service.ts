import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireOrgRoleForUser } from "@/server/rbac/access";
import { sendEmail } from "@/server/providers/email/provider";

const nameSchema = z.string().trim().min(2).max(100);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(80);
const roleSchema = z.enum(["ADMIN", "MANAGER", "CHECKIN", "FINANCE"]);

export async function createOrganization(userId: string, input: unknown) {
  const { name, slug } = z.object({ name: nameSchema, slug: slugSchema }).parse(input);
  return db.organization.create({ data: { name, slug, members: { create: { userId, role: "OWNER" } }, auditLogs: { create: { actorId: userId, action: "organization.created", entityType: "Organization", entityId: slug } } } });
}

export async function inviteMember(userId: string, orgId: string, input: unknown) {
  await requireOrgRoleForUser(userId, orgId, ["OWNER", "ADMIN"]);
  const { email, role } = z.object({ email: z.email(), role: roleSchema }).parse(input);
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  const token = randomBytes(32).toString("base64url");
  const invite = await db.invite.create({ data: {
    orgId, email: email.toLowerCase(), role, tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  } });
  try {
    await sendEmail({ to: email, subject: `Invitation to ${org.name}`, text: `You have been invited to ${org.name}. Accept: ${process.env.APP_URL}/accept-invite/${token}` });
  } catch (error) {
    await db.invite.delete({ where: { id: invite.id } });
    throw error;
  }
  await db.auditLog.create({ data: { orgId, actorId: userId, action: "member.invited", entityType: "Invite", entityId: invite.id, meta: { email, role } } });
  return { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt };
}

export async function acceptInvite(userId: string, token: string) {
  const hash = createHash("sha256").update(z.string().min(20).max(100).parse(token)).digest("hex");
  return db.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({ where: { tokenHash: hash } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date() || invite.email !== user.email.toLowerCase()) throw new Error("This invitation is invalid or expired.");
    const claimed = await tx.invite.updateMany({ where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date(), acceptedById: userId } });
    if (claimed.count !== 1) throw new Error("This invitation is invalid or expired.");
    await tx.organizationMember.upsert({ where: { orgId_userId: { orgId: invite.orgId, userId } }, update: { role: invite.role, status: "ACTIVE" }, create: { orgId: invite.orgId, userId, role: invite.role } });
    await tx.auditLog.create({ data: { orgId: invite.orgId, actorId: userId, action: "member.joined", entityType: "OrganizationMember", entityId: userId } });
    return invite.orgId;
  });
}

export async function changeMemberRole(actorId: string, orgId: string, memberId: string, role: unknown) {
  await requireOrgRoleForUser(actorId, orgId, ["OWNER", "ADMIN"]);
  const nextRole = roleSchema.parse(role);
  const target = await db.organizationMember.findUniqueOrThrow({ where: { orgId_userId: { orgId, userId: memberId } } });
  if (target.role === "OWNER") throw new Error("The owner role cannot be changed.");
  await db.organizationMember.update({ where: { orgId_userId: { orgId, userId: memberId } }, data: { role: nextRole } });
  await db.auditLog.create({ data: { orgId, actorId, action: "member.role_changed", entityType: "OrganizationMember", entityId: memberId, meta: { role: nextRole } } });
}

export async function removeMember(actorId: string, orgId: string, memberId: string) {
  await requireOrgRoleForUser(actorId, orgId, ["OWNER", "ADMIN"]);
  const target = await db.organizationMember.findUniqueOrThrow({ where: { orgId_userId: { orgId, userId: memberId } } });
  if (target.role === "OWNER") throw new Error("The owner cannot be removed.");
  await db.$transaction([
    db.eventStaff.deleteMany({ where: { userId: memberId, event: { orgId } } }),
    db.organizationMember.delete({ where: { orgId_userId: { orgId, userId: memberId } } }),
    db.auditLog.create({ data: { orgId, actorId, action: "member.removed", entityType: "OrganizationMember", entityId: memberId } }),
  ]);
}
