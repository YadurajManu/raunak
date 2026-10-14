import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { db } from "../src/server/db/client";

async function main() {
  const url = new URL("/api/webhooks/whatsapp", process.env.APP_URL);
  const token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const secret = process.env.WHATSAPP_APP_SECRET;
  assert.ok(token && secret, "WhatsApp credentials are missing");
  const challenge = new URL(url);
  challenge.search = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.verify_token": token,
    "hub.challenge": "987654321",
  }).toString();
  assert.equal(await (await fetch(challenge)).text(), "987654321");
  challenge.searchParams.set("hub.verify_token", "wrong-token");
  assert.equal((await fetch(challenge)).status, 403);
  const account = `smoke-${randomUUID()}`;
  const id = `wamid.${randomUUID()}`;
  const key = `message:${account}:${id}`;
  const body = JSON.stringify({
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
                  id,
                  type: "text",
                  text: { body: "Disposable deployment verification" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const headers = {
    "Content-Type": "application/json",
    "x-hub-signature-256":
      "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
  };
  try {
    assert.equal(
      (await fetch(url, { method: "POST", headers, body })).status,
      200,
    );
    assert.equal(
      (await fetch(url, { method: "POST", headers, body })).status,
      200,
    );
    assert.equal(
      await db.webhookEvent.count({
        where: { provider: "meta-whatsapp", idempotencyKey: key },
      }),
      1,
    );
    assert.equal(
      (await fetch(url, { method: "POST", headers, body: body + " " })).status,
      401,
    );
    console.log(
      "Live WhatsApp webhook passed: verification challenge, bad-token rejection, signed receipt persistence, retry deduplication, tampering rejection.",
    );
  } finally {
    await db.webhookEvent.deleteMany({
      where: { provider: "meta-whatsapp", idempotencyKey: key },
    });
  }
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Webhook verification failed",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
