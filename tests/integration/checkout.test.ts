import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import {
  createCheckout,
  applyPayment,
  releaseOrder,
  retryRefunds,
} from "@/server/checkout/service";
import { processCashfreeWebhook } from "@/server/checkout/webhook";
import { MockPaymentProvider } from "@/server/providers/payments/mock";
vi.mock("@/server/tickets/delivery", () => ({ queueTicketDelivery: vi.fn() }));
const key = randomUUID();
const provider = new MockPaymentProvider();
const org = await db.organization.create({
  data: { name: "Checkout test", slug: `checkout-${key}` },
});
const buyer = await db.user.create({
  data: {
    firebaseUid: `checkout-${key}`,
    email: `checkout-${key}@example.test`,
  },
});
const events: string[] = [];
afterAll(async () => {
  const orders = { order: { eventId: { in: events } } };
  await db.refund.deleteMany({ where: { payment: orders } });
  await db.payment.deleteMany({ where: orders });
  await db.ticket.deleteMany({ where: { eventId: { in: events } } });
  await db.orderItem.deleteMany({ where: orders });
  await db.order.deleteMany({ where: { eventId: { in: events } } });
  await db.ticketType.deleteMany({ where: { eventId: { in: events } } });
  await db.event.deleteMany({ where: { id: { in: events } } });
  await db.organization.delete({ where: { id: org.id } });
  await db.user.delete({ where: { id: buyer.id } });
  await db.webhookEvent.deleteMany({
    where: { provider: "cashfree", idempotencyKey: { startsWith: key } },
  });
});
async function setup(price = 10000, capacity = 5) {
  const event = await db.event.create({
    data: {
      orgId: org.id,
      slug: randomUUID(),
      title: "Test gathering",
      status: "PUBLISHED",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      capacity,
    },
  });
  events.push(event.id);
  const type = await db.ticketType.create({
    data: {
      eventId: event.id,
      name: "General",
      pricePaise: price,
      quantityTotal: capacity,
      maxPerOrder: 10,
    },
  });
  const cart = () => ({
    eventId: event.id,
    items: [{ ticketTypeId: type.id, quantity: 1 }],
    buyerName: "Test buyer",
    buyerPhone: "9876543210",
    idempotencyKey: randomUUID(),
  });
  return { event, type, cart };
}
it("never oversells under concurrent checkouts and safely expires holds", async () => {
  const { type, cart } = await setup();
  const outcomes = await Promise.allSettled(
    Array.from({ length: 12 }, () => createCheckout(buyer, cart(), provider)),
  );
  const orders = outcomes
    .filter((x) => x.status === "fulfilled")
    .map((x) => x.value);
  expect(orders).toHaveLength(5);
  expect(
    (await db.ticketType.findUniqueOrThrow({ where: { id: type.id } }))
      .quantityHeld,
  ).toBe(5);
  await db.order.updateMany({
    where: { id: { in: orders.map((x) => x.id) } },
    data: { expiresAt: new Date(0) },
  });
  await Promise.all(orders.map((order) => releaseOrder(order.id, "EXPIRED")));
  expect(
    (await db.ticketType.findUniqueOrThrow({ where: { id: type.id } }))
      .quantityHeld,
  ).toBe(0);
});
it("issues free tickets once and rejects idempotency keys reused for another cart", async () => {
  const { type, cart } = await setup(0);
  const input = cart();
  const first = await createCheckout(buyer, input, provider);
  expect(first.status).toBe("PAID");
  expect((await createCheckout(buyer, input, provider)).id).toBe(first.id);
  expect(await db.ticket.count({ where: { orderId: first.id } })).toBe(1);
  await expect(
    createCheckout(
      buyer,
      { ...input, items: [{ ticketTypeId: type.id, quantity: 2 }] },
      provider,
    ),
  ).rejects.toThrow("another cart");
});
it("verifies payment signatures, rejects wrong amounts, and deduplicates successful webhooks", async () => {
  const { type, cart } = await setup();
  const order = await createCheckout(buyer, cart(), provider);
  await expect(
    applyPayment(
      order.id,
      { id: randomUUID(), status: "SUCCESS", amountPaise: 1, raw: {} },
      provider,
    ),
  ).rejects.toThrow("amount");
  const raw = JSON.stringify({
    type: "PAYMENT_SUCCESS_WEBHOOK",
    data: {
      order: { order_id: order.cashfreeOrderId, order_currency: "INR" },
      payment: {
        cf_payment_id: key,
        payment_status: "SUCCESS",
        payment_amount: order.totalPaise / 100,
        payment_currency: "INR",
      },
    },
  });
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", "test-secret")
    .update(timestamp + raw)
    .digest("base64");
  await expect(
    processCashfreeWebhook(raw, timestamp, "bad", provider, "test-secret"),
  ).rejects.toThrow("signature");
  const failedPayload = JSON.parse(raw);
  failedPayload.type = "PAYMENT_FAILED_WEBHOOK";
  failedPayload.data.payment.payment_status = "FAILED";
  const failed = JSON.stringify(failedPayload);
  const failedSignature = createHmac("sha256", "test-secret").update(timestamp + failed).digest("base64");
  await processCashfreeWebhook(failed, timestamp, failedSignature, provider, "test-secret");
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  expect((await db.ticketType.findUniqueOrThrow({ where: { id: type.id } })).quantityHeld).toBe(1);
  await processCashfreeWebhook(
    raw,
    timestamp,
    signature,
    provider,
    "test-secret",
  );
  await processCashfreeWebhook(
    raw,
    timestamp,
    signature,
    provider,
    "test-secret",
  );
  expect(await db.ticket.count({ where: { orderId: order.id } })).toBe(1);
  const inventory = await db.ticketType.findUniqueOrThrow({
    where: { id: type.id },
  });
  expect([inventory.quantitySold, inventory.quantityHeld]).toEqual([1, 0]);
  const unrelated = JSON.parse(raw);
  unrelated.data.order.order_id = randomUUID();
  const unrelatedRaw = JSON.stringify(unrelated);
  const unrelatedSignature = createHmac("sha256", "test-secret").update(timestamp + unrelatedRaw).digest("base64");
  expect(await processCashfreeWebhook(unrelatedRaw, timestamp, unrelatedSignature, provider, "test-secret")).toBeNull();
});
it("does not issue entry tickets when an event is cancelled during checkout", async () => {
  const { event, type, cart } = await setup();
  const order = await createCheckout(buyer, cart(), provider);
  await db.event.update({ where: { id: event.id }, data: { status: "CANCELLED" } });
  await applyPayment(order.id, {
    id: randomUUID(), status: "SUCCESS", amountPaise: order.totalPaise, raw: {},
  }, provider);
  expect(await db.ticket.count({ where: { orderId: order.id } })).toBe(0);
  expect((await db.ticketType.findUniqueOrThrow({ where: { id: type.id } })).quantityHeld).toBe(0);
  expect(await db.refund.count({ where: { payment: { orderId: order.id } } })).toBe(1);
});

it("refunds late payments without issuing unavailable tickets and reconciles pending refunds", async () => {
  const { type, cart } = await setup(10000, 1);
  const expired = await createCheckout(buyer, cart(), provider);
  await db.order.update({
    where: { id: expired.id },
    data: { expiresAt: new Date(0) },
  });
  await releaseOrder(expired.id, "EXPIRED");
  await createCheckout(buyer, cart(), provider);
  await applyPayment(
    expired.id,
    {
      id: randomUUID(),
      status: "SUCCESS",
      amountPaise: expired.totalPaise,
      raw: {},
    },
    provider,
  );
  expect(await db.ticket.count({ where: { orderId: expired.id } })).toBe(0);
  expect(
    (await db.order.findUniqueOrThrow({ where: { id: expired.id } })).status,
  ).toBe("EXPIRED");
  await retryRefunds(provider);
  expect(
    (await db.order.findUniqueOrThrow({ where: { id: expired.id } })).status,
  ).toBe("REFUNDED");
  expect(
    (await db.ticketType.findUniqueOrThrow({ where: { id: type.id } }))
      .quantityHeld,
  ).toBe(1);
});
