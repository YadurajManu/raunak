import "dotenv/config";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import Redis from "ioredis";
import { afterAll, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { MockEngine } from "../../services/wa-gateway/src/engines/mock";
import { GatewayRuntime } from "../../services/wa-gateway/src/runtime";
import { gatewayServer } from "../../services/wa-gateway/src/http";
import { BaileysGatewayProvider } from "@/server/providers/whatsapp/gateway";

const org = await db.organization.create({
  data: {
    name: "Gateway test",
    slug: `gateway-${randomUUID()}`,
    whatsappMode: "ORG_NUMBER",
  },
});
const session = await db.whatsAppSession.create({ data: { orgId: org.id } });
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
});
const engine = new MockEngine(),
  runtime = new GatewayRuntime(redis, engine);
const secret = "gateway-test-key-".repeat(3),
  server = gatewayServer(runtime, secret);
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string")
  throw new Error("Missing gateway address");
const url = `http://127.0.0.1:${address.port}`;
afterAll(async () => {
  await runtime.close();
  server.close();
  server.closeAllConnections();
  await db.whatsAppSession.delete({ where: { id: session.id } });
  await db.organization.delete({ where: { id: org.id } });
  await redis.quit();
  vi.unstubAllEnvs();
});
it("rejects unauthenticated calls and keeps cross-org sessions inaccessible", async () => {
  expect((await fetch(`${url}/healthz`)).status).toBe(401);
  expect(
    (
      await fetch(`${url}/healthz`, {
        headers: { Authorization: `Bearer ${secret}` },
      })
    ).status,
  ).toBe(200);
  await expect(runtime.scoped(session.id, randomUUID())).rejects.toThrow(
    "SESSION_DISCONNECTED",
  );
  await expect(runtime.create(org.id, randomUUID())).rejects.toThrow(
    "SESSION_DISCONNECTED",
  );
});
it("worker provider sends through the private API, serializes and deduplicates retries", async () => {
  vi.stubEnv("WA_UNOFFICIAL_ENABLED", "true");
  vi.stubEnv("WA_GATEWAY_URL", url);
  vi.stubEnv("WA_GATEWAY_API_KEY", secret);
  await runtime.connect(session.id, org.id);
  const competitor = new GatewayRuntime(redis, new MockEngine());
  await expect(competitor.connect(session.id, org.id)).rejects.toThrow(
    "SESSION_PAUSED",
  );
  await vi.waitFor(async () =>
    expect((await runtime.status(session.id, org.id)).status).toBe(
      "QR_PENDING",
    ),
  );
  engine.emit({
    type: "status",
    sessionId: session.id,
    status: "CONNECTED",
    phoneE164: "+919876543210",
  });
  await vi.waitFor(async () =>
    expect((await runtime.status(session.id, org.id)).status).toBe("CONNECTED"),
  );
  const provider = new BaileysGatewayProvider();
  const message = {
    clientMessageId: randomUUID(),
    orgId: org.id,
    to: "+919876543210",
    trigger: "TICKET_ISSUED" as const,
    timezone: "Asia/Kolkata",
    text: "Your ticket",
    consent: true,
    attachments: [],
  };
  const first = await provider.send(session.id, message),
    duplicate = await provider.send(session.id, message);
  expect(first).toEqual(duplicate);
  expect(engine.sent).toHaveLength(1);
  await expect(
    provider.send(session.id, {
      ...message,
      clientMessageId: randomUUID(),
      orgId: randomUUID(),
    }),
  ).rejects.toThrow("SESSION_DISCONNECTED");
  vi.stubEnv("WA_UNOFFICIAL_ENABLED", "false");
  await expect(
    provider.send(session.id, { ...message, clientMessageId: randomUUID() }),
  ).rejects.toThrow("KILL_SWITCH");
});
