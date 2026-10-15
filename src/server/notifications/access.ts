import { requireEventAccessForUser, requireOrgRoleForUser } from "@/server/rbac/access";
export async function messageAccess(userId: string, eventId: string | null, orgId?: string) {
  if (eventId) return requireEventAccessForUser(userId, eventId, ["OWNER", "ADMIN", "MANAGER"]);
  if (!orgId) throw new Error("Workspace is required.");
  await requireOrgRoleForUser(userId, orgId, ["OWNER", "ADMIN"]);
  return { orgId };
}
