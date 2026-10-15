import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { integrationAction, integrationStatus, warmupCap } from "@/server/whatsapp/integration";
const suffix = randomUUID();
const owner = await db.user.create({ data: { firebaseUid: `wa-settings-${suffix}`, email: `wa-settings-${suffix}@example.test` } });
const org = await db.organization.create({ data: { name: "Settings test", slug: `wa-settings-${suffix}`, members: { create: { userId: owner.id, role: "OWNER" } } } });
afterAll(async () => {
  await db.auditLog.deleteMany({ where: { orgId: org.id } });
  await db.organizationMember.deleteMany({ where: { orgId: org.id } });
  await db.organization.delete({ where: { id: org.id } });
  await db.user.delete({ where: { id: owner.id } });
});
it("allows only workspace owners/admins to inspect and change integrations, with audit", async () => {
  await expect(integrationStatus(randomUUID(), org.id)).rejects.toThrow("Access denied");
  await expect(integrationAction(randomUUID(), org.id, { action: "connect" })).rejects.toThrow("Access denied");
  expect((await integrationStatus(owner.id, org.id)).mode).toBe("DISABLED");
  await integrationAction(owner.id, org.id, { action: "mode", mode: "ORG_NUMBER" });
  expect((await integrationStatus(owner.id, org.id)).mode).toBe("ORG_NUMBER");
  expect(await db.auditLog.count({ where: { orgId: org.id, action: "whatsapp.mode" } })).toBe(1);
  await expect(integrationAction(owner.id, org.id, { action: "test", phone: "+919876543210", consent: false })).rejects.toThrow();
});
it("shows the conservative warm-up limit, including per-session lower caps", () => {
  const now = Date.now();
  for (const [day, cap] of [[1, 30], [2, 30], [3, 60], [5, 120], [8, 250], [15, 400]]) expect(warmupCap(new Date(now - (day - 1) * 86400000), 400, null, now)).toEqual({ day, cap });
  expect(warmupCap(new Date(now), 400, 10, now).cap).toBe(10);
});
