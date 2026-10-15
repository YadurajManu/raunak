import "dotenv/config";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import {
  PolicyEngine,
  quietDelay,
  policyConfigSchema,
} from "../../services/wa-gateway/src/policy";
import { MockEngine } from "../../services/wa-gateway/src/engines/mock";
import type { GatewayMessage } from "@raunak/wa-contracts";
const org = await db.organization.create({
  data: { name: "Policy test", slug: `policy-${randomUUID()}` },
});
const initial = await db.whatsAppSession.create({
  data: { orgId: org.id, status: "CONNECTED", warmupStartedAt: new Date() },
});
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
});
const engine = new MockEngine();
const input: GatewayMessage = {
  clientMessageId: randomUUID(),
  orgId: org.id,
  to: "+919876543210",
  trigger: "TICKET_ISSUED",
  timezone: "Asia/Kolkata",
  text: "Your ticket",
  consent: true,
  attachments: [],
};
async function clear() {
  const keys = await redis.keys(`wa:*${initial.id}*`);
  if (keys.length) await redis.del(...keys);
  await db.whatsAppSuppression.deleteMany({ where: { orgId: org.id } });
}
beforeEach(async () => {
  await clear();
  engine.unavailable.clear();
  vi.stubEnv("WA_UNOFFICIAL_ENABLED", "true");
  await db.whatsAppSession.update({
    where: { id: initial.id },
    data: { status: "CONNECTED", dailyCapOverride: null },
  });
});
afterAll(async () => {
  await clear();
  await db.whatsAppSession.delete({ where: { id: initial.id } });
  await db.organization.delete({ where: { id: org.id } });
  await redis.quit();
  vi.unstubAllEnvs();
});
it("requires consent and skips suppressed and unregistered numbers", async () => {
  const policy = new PolicyEngine(redis, engine);
  await expect(
    policy.check(initial, { ...input, consent: false }),
  ).rejects.toThrow("NO_CONSENT");
  engine.unavailable.add(input.to);
  await expect(policy.check(initial, input)).rejects.toThrow("NOT_ON_WHATSAPP");
  expect(
    (await db.whatsAppSuppression.findFirst({ where: { orgId: org.id } }))
      ?.reason,
  ).toBe("NOT_ON_WHATSAPP");
  await expect(policy.check(initial, input)).rejects.toThrow("SUPPRESSED");
  vi.stubEnv("WA_UNOFFICIAL_ENABLED", "false");
  await expect(policy.check(initial, input)).rejects.toThrow("KILL_SWITCH");
});
it("atomically enforces recipient, minute and daily caps without charging rejected sends", async () => {
  const policy = new PolicyEngine(redis, engine);
  for (let i = 0; i < 6; i++) await policy.check(initial, input);
  await expect(policy.check(initial, input)).rejects.toThrow("WA_CAP_REACHED");
  const usage = `wa:usage:${initial.id}:${new Date().toISOString().slice(0, 10)}`;
  expect(await redis.get(usage)).toBe("6");
  await policy.check(initial, { ...input, to: "+919876543211" });
  await policy.check(initial, { ...input, to: "+919876543212" });
  await expect(
    policy.check(initial, { ...input, to: "+919876543213" }),
  ).rejects.toThrow("WA_CAP_REACHED");
  await clear();
  const lower = { ...initial, dailyCapOverride: 1 };
  await policy.check(lower, input);
  await expect(policy.check(lower, input)).rejects.toThrow("WA_CAP_REACHED");
  expect(await redis.get(usage)).toBe("1");
});
it("defers reminders in local quiet hours, including DST, while exempting tickets", () => {
  const now = Date.parse("2026-10-15T17:30:00Z");
  expect(quietDelay("REMINDER_2H", "Asia/Kolkata", now)).toBe(8 * 3600000);
  expect(quietDelay("TICKET_ISSUED", "Asia/Kolkata", now)).toBe(0);
  expect(
    quietDelay(
      "REMINDER_2H",
      "Asia/Kolkata",
      Date.parse("2026-10-15T06:00:00Z"),
    ),
  ).toBe(0);
  expect(
    quietDelay(
      "REMINDER_24H",
      "America/New_York",
      Date.parse("2026-11-01T02:00:00Z"),
    ),
  ).toBe(10 * 3600000);
  expect(() =>
    policyConfigSchema.parse({ WA_MIN_DELAY_MS: 12000, WA_MAX_DELAY_MS: 4000 }),
  ).toThrow();
});
it("pauses after three consecutive failures and refuses a paused session", async () => {
  const policy = new PolicyEngine(redis, engine);
  expect(await policy.failed(initial.id)).toBe(false);
  expect(await policy.failed(initial.id)).toBe(false);
  expect(await policy.failed(initial.id)).toBe(true);
  const paused = await db.whatsAppSession.findUniqueOrThrow({
    where: { id: initial.id },
  });
  expect(paused.status).toBe("PAUSED");
  expect(paused.pausedUntil!.getTime()).toBeGreaterThan(Date.now() + 890000);
  await expect(policy.check(paused, input)).rejects.toThrow("SESSION_PAUSED");
});
