import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import {
  alertSession,
  deliverAlerts,
} from "../../services/wa-gateway/src/alerts";
it("durably retries connection alerts and uses separate idempotency keys for owner and admin", async () => {
  const suffix = randomUUID(),
    owner = await db.user.create({
      data: {
        firebaseUid: `wa-alert-${suffix}`,
        email: `owner-${suffix}@example.test`,
      },
    });
  const org = await db.organization.create({
    data: {
      name: "Alert test",
      slug: `alert-${suffix}`,
      members: { create: { userId: owner.id, role: "OWNER" } },
    },
  });
  const session = await db.whatsAppSession.create({
    data: { orgId: org.id, status: "LOGGED_OUT" },
  });
  vi.stubEnv("WA_ADMIN_EMAIL", "platform-admin@example.test");
  try {
    await expect(
      alertSession(session.id, "LOGGED_OUT", {
        send: async () => {
          throw new Error("Simulated outage");
        },
      }),
    ).rejects.toThrow("Simulated outage");
    expect(
      (
        await db.webhookEvent.findFirstOrThrow({
          where: {
            provider: "baileys-alert",
            payload: { path: ["sessionId"], equals: session.id },
          },
        })
      ).status,
    ).toBe("FAILED");
    const send = vi.fn();
    await deliverAlerts({ send });
    expect(send).toHaveBeenCalledTimes(2);
    expect(
      new Set(send.mock.calls.map((call) => call[0].idempotencyKey)).size,
    ).toBe(2);
    await alertSession(session.id, "LOGGED_OUT", { send });
    expect(send).toHaveBeenCalledTimes(2);
  } finally {
    await db.webhookEvent.deleteMany({
      where: {
        provider: "baileys-alert",
        payload: { path: ["sessionId"], equals: session.id },
      },
    });
    await db.whatsAppSession.delete({ where: { id: session.id } });
    await db.organizationMember.deleteMany({ where: { orgId: org.id } });
    await db.organization.delete({ where: { id: org.id } });
    await db.user.delete({ where: { id: owner.id } });
    vi.unstubAllEnvs();
  }
});
