import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
const mail = vi.hoisted(() => vi.fn());
vi.mock("@/server/providers/email/provider", () => ({ sendEmail: mail }));
import { db } from "@/server/db/client";
import {
  exportPersonalData,
  requestAccountDeletion,
} from "@/server/profile/privacy";
import { saveInterests } from "@/server/profile/service";

const enabled = process.env.RUN_PROFILE_PRIVACY_INTEGRATION === "true";
if (enabled) {
  const target = new URL(process.env.DATABASE_URL || "");
  if (!["localhost", "127.0.0.1"].includes(target.hostname) || !/^\/(?:test_|raunak_profile_)[\w-]+$/.test(target.pathname))
    throw new Error("This test requires an explicitly enabled isolated local test database.");
}
describe.skipIf(!enabled)("personal privacy persistence", () => {
const ids: string[] = [];
async function user() {
  const key = randomUUID();
  const result = await db.user.create({
    data: {
      firebaseUid: `private-${key}`,
      email: `${key}@example.test`,
      phone: "+919876543210",
    },
  });
  ids.push(result.id);
  return result;
}
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

it("persists interests and exports only explicitly selected own data", async () => {
  const a = await user();
  const b = await user();
  await saveInterests(a.id, { interestCategories: ["Arts & culture"] });
  const data = await exportPersonalData(a.id);
  expect(data.account.interestCategories).toEqual(["Arts & culture"]);
  expect(data.account.email).toBe(a.email);
  expect(JSON.stringify(data)).not.toContain(b.email);
  expect(data.account).not.toHaveProperty("firebaseUid");
  expect(data.account).not.toHaveProperty("id");
  expect(data.account).not.toHaveProperty("deletionNotificationAttemptAt");
});

it("exports owned booking summaries without payment sessions or other buyers", async () => {
  const a = await user(); const b = await user();
  const key = randomUUID();
  const org = await db.organization.create({ data: { name: "Privacy test", slug: key } });
  const event = await db.event.create({ data: { orgId: org.id, slug: key, title: "Private test event", startsAt: new Date(), endsAt: new Date(Date.now() + 60_000) } });
  try {
    const own = await db.order.create({ data: { eventId: event.id, buyerId: a.id, buyerName: "Owner", buyerEmail: a.email, subtotalPaise: 100, totalPaise: 100, expiresAt: new Date(), idempotencyKey: randomUUID(), paymentSessionId: "never-export-session" } });
    const other = await db.order.create({ data: { eventId: event.id, buyerId: b.id, buyerName: "Other", buyerEmail: b.email, subtotalPaise: 200, totalPaise: 200, expiresAt: new Date(), idempotencyKey: randomUUID() } });
    const exported = await exportPersonalData(a.id);
    expect(exported.bookings.map((booking) => booking.id)).toEqual([own.id]);
    expect(JSON.stringify(exported)).not.toContain(other.id);
    expect(JSON.stringify(exported)).not.toContain("never-export-session");
    expect(exported.bookings[0]).not.toHaveProperty("tickets");
  } finally {
    await db.order.deleteMany({ where: { eventId: event.id } });
    await db.event.delete({ where: { id: event.id } });
    await db.organization.delete({ where: { id: org.id } });
  }
});

it("atomically allows one deletion notification during concurrent requests", async () => {
  const a = await user();
  mail.mockResolvedValue(undefined);
  const now = new Date();
  const results = await Promise.allSettled([
    requestAccountDeletion(a.id, now),
    requestAccountDeletion(a.id, now),
  ]);
  expect(results.some((result) => result.status === "fulfilled")).toBe(true);
  expect(mail).toHaveBeenCalledTimes(1);
  const pending = await requestAccountDeletion(a.id, now);
  expect(pending.pending).toBe(true);
  expect(mail).toHaveBeenCalledTimes(1);
  expect(await db.user.findUnique({ where: { id: a.id } })).not.toBeNull();
});

it("durably records failed notification requests, throttles, then retries without losing identity", async () => {
  mail.mockClear();
  const a = await user();
  const now = new Date();
  mail.mockRejectedValueOnce(new Error("mail credentials"));
  await expect(requestAccountDeletion(a.id, now)).rejects.toMatchObject({
    status: 503,
  });
  const recorded = await db.user.findUniqueOrThrow({ where: { id: a.id } });
  expect(recorded.deletionRequestedAt).toEqual(now);
  expect(recorded.deletionNotificationSentAt).toBeNull();
  await expect(requestAccountDeletion(a.id, now)).rejects.toMatchObject({
    status: 429,
  });
  expect(mail).toHaveBeenCalledTimes(1);
  mail.mockResolvedValueOnce(undefined);
  const retry = await requestAccountDeletion(
    a.id,
    new Date(now.getTime() + 60_001),
  );
  expect(retry.requestedAt).toBe(now.toISOString());
  expect(mail).toHaveBeenCalledTimes(2);
  expect(mail.mock.calls[0][0].idempotencyKey).toBe(
    mail.mock.calls[1][0].idempotencyKey,
  );
});
});
