import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { integrationAction, integrationStatus, warmupCap } from "@/server/whatsapp/integration";
import { resolveWhatsApp } from "@/server/whatsapp/routing";
const suffix = randomUUID();
const owner = await db.user.create({ data: { firebaseUid: `wa-settings-${suffix}`, email: `wa-settings-${suffix}@example.test` } });
const org = await db.organization.create({ data: { name: "Settings test", slug: `wa-settings-${suffix}`, members: { create: { userId: owner.id, role: "OWNER" } } } });
beforeEach(async () => {
  vi.unstubAllEnvs();
  await db.whatsAppSession.deleteMany({ where: { orgId: org.id } });
  await db.organization.update({ where: { id: org.id }, data: { whatsappMode: "DISABLED" } });
  await db.auditLog.deleteMany({ where: { orgId: org.id } });
});
afterAll(async () => {
  await db.auditLog.deleteMany({ where: { orgId: org.id } });
  await db.whatsAppSession.deleteMany({ where: { orgId: org.id } });
  await db.organizationMember.deleteMany({ where: { orgId: org.id } });
  await db.organization.delete({ where: { id: org.id } });
  await db.user.delete({ where: { id: owner.id } });
  vi.unstubAllEnvs();
});
it("routes explicit modes to the existing official API or an owned connected session", async () => {
  await db.organization.update({ where: { id: org.id }, data: { whatsappMode: "DISABLED" } });
  await expect(resolveWhatsApp(org.id)).rejects.toThrow("KILL_SWITCH");
  await db.organization.update({ where: { id: org.id }, data: { whatsappMode: "OFFICIAL_API" } });
  expect((await resolveWhatsApp(org.id)).kind).toBe("official");
  await db.organization.update({ where: { id: org.id }, data: { whatsappMode: "ORG_NUMBER" } });
  vi.stubEnv("WHATSAPP_PROVIDER", "mock"); vi.stubEnv("WA_UNOFFICIAL_ENABLED", "true");
  await expect(resolveWhatsApp(org.id)).rejects.toThrow("SESSION_DISCONNECTED");
  const session = await db.whatsAppSession.create({ data: { orgId: org.id, status: "CONNECTED" } });
  const route = await resolveWhatsApp(org.id); expect(route.kind).toBe("gateway");
  if (route.kind === "gateway") expect(route.sessionId).toBe(session.id);
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
