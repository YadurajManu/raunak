import { beforeEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "../../src/app/api/webhooks/whatsapp/route";
const { createMany, updateMany } = vi.hoisted(() => ({
  createMany: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock("@/server/db/client", () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({ webhookEvent: { createMany }, notificationLog: { updateMany } }),
  },
}));
import {
  receiveWebhook,
  webhookSchema,
} from "../../src/server/whatsapp/webhook";
beforeEach(() => {
  createMany.mockReset().mockResolvedValue({ count: 1 });
  updateMany.mockReset().mockResolvedValue({ count: 1 });
});
function payload(status: string) {
  return webhookSchema.parse({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "account",
        changes: [
          {
            field: "messages",
            value: { statuses: [{ id: "wamid.test", status }] },
          },
        ],
      },
    ],
  });
}
it("prevents late delivery events from downgrading a read message", async () => {
  await receiveWebhook(payload("delivered"));
  expect(updateMany.mock.calls[0][0].where.status.in).not.toContain("READ");
  expect(updateMany.mock.calls[0][0].data.status).toBe("DELIVERED");
  updateMany.mockClear();
  await receiveWebhook(payload("failed"));
  expect(updateMany.mock.calls[0][0].where.status.in).toEqual([
    "QUEUED",
    "SENDING",
    "SENT",
  ]);
});
it("ignores duplicates and archives unknown statuses without changing delivery", async () => {
  createMany.mockResolvedValueOnce({ count: 0 });
  await receiveWebhook(payload("read"));
  expect(updateMany).not.toHaveBeenCalled();
  await receiveWebhook(payload("toString"));
  expect(updateMany).not.toHaveBeenCalled();
});

it("returns a retryable failure instead of acknowledging a lost receipt", async () => {
  vi.stubEnv("WHATSAPP_APP_SECRET", "test-secret");
  createMany.mockRejectedValueOnce(new Error("Database unavailable"));
  const body = JSON.stringify(payload("read"));
  try {
    const response = await POST(
      new Request("https://raunak.example/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "x-hub-signature-256":
            "sha256=" +
            createHmac("sha256", "test-secret").update(body).digest("hex"),
        },
        body,
      }),
    );
    expect(response.status).toBe(503);
  } finally {
    vi.unstubAllEnvs();
  }
});
