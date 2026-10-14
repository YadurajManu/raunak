import { beforeEach, expect, it, vi } from "vitest";
const processWebhook = vi.hoisted(() => vi.fn());
vi.mock("@/server/checkout/webhook", () => ({ processCashfreeWebhook: processWebhook }));
import { GET, POST } from "@/app/api/webhooks/cashfree/route";

beforeEach(() => processWebhook.mockReset());

it("answers a read-only endpoint reachability check without processing payments", async () => {
  const response = GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, service: "cashfree-webhook" });
  expect(processWebhook).not.toHaveBeenCalled();
});

it("continues to reject invalid payment signatures", async () => {
  processWebhook.mockRejectedValue(new Error("Invalid webhook signature."));
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const response = await POST(new Request("https://example.test/webhook", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
    expect(log).toHaveBeenCalledWith("Cashfree webhook rejected", { reason: "signature" });
  } finally { log.mockRestore(); }
});
