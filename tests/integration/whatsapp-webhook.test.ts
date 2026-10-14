import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, afterEach, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { GET, POST } from "../../src/app/api/webhooks/whatsapp/route";
const account = `test-${randomUUID()}`;
const messageId = `wamid.${randomUUID()}`;
const secret = "test-meta-app-secret";
const verification = "test-webhook-verification";
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await db.webhookEvent.deleteMany({
    where: { provider: "meta-whatsapp", idempotencyKey: { contains: account } },
  });
});
function configured() {
  vi.stubEnv("WHATSAPP_APP_SECRET", secret);
  vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", verification);
}
function signed(body: string, override?: string) {
  return new Request("https://raunak.example/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256":
        override ||
        "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
    },
    body,
  });
}
it("echoes Meta's challenge only for the configured verification token", async () => {
  configured();
  const url = `https://raunak.example/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verification}&hub.challenge=123456`;
  expect(await GET(new Request(url)).text()).toBe("123456");
  expect(GET(new Request(url.replace(verification, "wrong"))).status).toBe(403);
  vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "");
  expect(GET(new Request(url)).status).toBe(503);
});
it("persists authenticated inbound messages and deduplicates retries", async () => {
  configured();
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: account,
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: account },
              messages: [
                {
                  id: messageId,
                  from: "919876543210",
                  type: "text",
                  text: { body: "Webhook test" },
                },
              ],
              statuses: [
                { id: messageId, status: "read", timestamp: "1728900000" },
              ],
            },
          },
        ],
      },
    ],
  };
  const body = JSON.stringify(payload);
  expect((await POST(signed(body))).status).toBe(200);
  expect((await POST(signed(body))).status).toBe(200);
  const receipts = await db.webhookEvent.findMany({
    where: { provider: "meta-whatsapp", idempotencyKey: { contains: account } },
  });
  expect(receipts).toHaveLength(2);
  expect(receipts.every((x) => x.status === "PROCESSED")).toBe(true);
  expect(
    (
      await POST(
        signed(
          body + " ",
          "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
        ),
      )
    ).status,
  ).toBe(401);
});
it("rejects forged, malformed, oversized, and unconfigured requests", async () => {
  configured();
  expect((await POST(signed("{}", "sha256=" + "0".repeat(64)))).status).toBe(
    401,
  );
  expect((await POST(signed("{"))).status).toBe(400);
  expect(
    (await POST(signed(JSON.stringify({ object: "page", entry: [] })))).status,
  ).toBe(400);
  expect((await POST(signed("x".repeat(1024 * 1024 + 1)))).status).toBe(413);
  vi.stubEnv("WHATSAPP_APP_SECRET", "");
  expect((await POST(signed("{}"))).status).toBe(503);
});
