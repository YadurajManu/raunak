import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { acceptInvite, createOrganization, inviteMember } from "@/server/orgs/service";
import { requireOrgRoleForUser } from "@/server/rbac/access";

const sent: string[] = [];
vi.mock("@/server/providers/email/provider", () => ({ sendEmail: async ({ text }: { text: string }) => { sent.push(text); } }));

const key = randomUUID().slice(0, 8);
let ownerId: string;
let inviteeId: string;
let orgId: string;
let otherOrgId: string;

beforeAll(async () => {
  const owner = await db.user.create({ data: { firebaseUid: `test-owner-${key}`, email: `owner-${key}@example.test` } });
  const invitee = await db.user.create({ data: { firebaseUid: `test-invitee-${key}`, email: `invitee-${key}@example.test` } });
  ownerId = owner.id;
  inviteeId = invitee.id;
  orgId = (await createOrganization(ownerId, { name: "First club", slug: `first-${key}` })).id;
  otherOrgId = (await createOrganization(inviteeId, { name: "Second club", slug: `second-${key}` })).id;
});

afterAll(async () => {
  if (orgId) { await db.auditLog.deleteMany({ where: { orgId } }); await db.organization.delete({ where: { id: orgId } }); }
  if (otherOrgId) { await db.auditLog.deleteMany({ where: { orgId: otherOrgId } }); await db.organization.delete({ where: { id: otherOrgId } }); }
  if (ownerId) await db.user.delete({ where: { id: ownerId } });
  if (inviteeId) await db.user.delete({ where: { id: inviteeId } });
});

describe("organization isolation and invitations", () => {
  it("denies cross-organization access", async () => {
    await expect(requireOrgRoleForUser(ownerId, otherOrgId, ["OWNER"])).rejects.toThrow("Access denied");
    await expect(requireOrgRoleForUser(inviteeId, orgId, ["OWNER"])).rejects.toThrow("Access denied");
  });

  it("accepts an emailed invite for its intended user", async () => {
    await inviteMember(ownerId, orgId, { email: `invitee-${key}@example.test`, role: "CHECKIN" });
    const token = sent.at(-1)?.match(/accept-invite\/([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();
    await expect(acceptInvite(ownerId, token!)).rejects.toThrow("invalid or expired");
    await expect(acceptInvite(inviteeId, token!)).resolves.toBe(orgId);
    await expect(requireOrgRoleForUser(inviteeId, orgId, ["CHECKIN"])).resolves.toMatchObject({ role: "CHECKIN" });
    await expect(acceptInvite(inviteeId, token!)).rejects.toThrow("invalid or expired");
  });
});
