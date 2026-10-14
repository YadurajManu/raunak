import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it, vi } from "vitest";
vi.mock("@/server/tickets/delivery", () => ({ queueTicketDelivery: vi.fn() }));
vi.mock("../../worker/queues", () => ({ notificationQueue: { getJob: async () => null, add: vi.fn() } }));
const auth = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ requireUser: auth.user }));
import { db } from "@/server/db/client";
import {
  createCheckout,
  applyPayment,
  retryRefunds,
} from "@/server/checkout/service";
import { MockPaymentProvider } from "@/server/providers/payments/mock";
import { refundBooking } from "@/server/operations/refunds";
import { processOperationsEmail } from "@/server/operations/email";
import { resendOrderNotifications } from "@/server/notifications/service";
import { GET } from "@/app/api/events/[eventId]/attendees/export/route";
const key = randomUUID();
const owner = await db.user.create({
  data: { firebaseUid: `ops-owner-${key}`, email: `owner-${key}@example.test` },
});
const buyer = await db.user.create({
  data: { firebaseUid: `ops-buyer-${key}`, email: `buyer-${key}@example.test` },
});
const manager = await db.user.create({
  data: {
    firebaseUid: `ops-manager-${key}`,
    email: `manager-${key}@example.test`,
  },
});
const org = await db.organization.create({
  data: {
    slug: `ops-${key}`,
    name: "Operations test",
    members: {
      create: [
        { userId: owner.id, role: "OWNER" },
        { userId: manager.id, role: "MANAGER" },
      ],
    },
  },
});
const event = await db.event.create({
  data: {
    orgId: org.id,
    slug: `ops-${key}`,
    title: "Operations test",
    status: "PUBLISHED",
    startsAt: new Date(Date.now() + 86400000),
    endsAt: new Date(Date.now() + 90000000),
  },
});
const type = await db.ticketType.create({
  data: {
    eventId: event.id,
    name: "Guest",
    pricePaise: 5000,
    quantityTotal: 100,
  },
});
const provider = new MockPaymentProvider();
const orderIds: string[] = [];
async function booking(free = false) {
  await db.ticketType.update({
    where: { id: type.id },
    data: { pricePaise: free ? 0 : 5000 },
  });
  const order = await createCheckout(
    buyer,
    {
      eventId: event.id,
      buyerName: "Test guest",
      buyerPhone: "9876543210",
      idempotencyKey: randomUUID(),
      items: [{ ticketTypeId: type.id, quantity: 1 }],
    },
    provider,
  );
  orderIds.push(order.id);
  if (!free)
    await applyPayment(
      order.id,
      {
        id: randomUUID(),
        status: "SUCCESS",
        amountPaise: order.totalPaise,
        raw: {},
      },
      provider,
    );
  return order;
}
afterAll(async () => {
  await db.notificationLog.deleteMany({ where: { eventId: event.id } });
  for (const orderId of orderIds)
    await db.webhookEvent.deleteMany({
      where: {
        provider: "operations-email",
        payload: { path: ["orderId"], equals: orderId },
      },
    });
  await db.refund.deleteMany({
    where: { payment: { orderId: { in: orderIds } } },
  });
  await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.ticket.deleteMany({ where: { eventId: event.id } });
  await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { eventId: event.id } });
  await db.ticketType.delete({ where: { id: type.id } });
  await db.event.delete({ where: { id: event.id } });
  await db.auditLog.deleteMany({ where: { orgId: org.id } });
  await db.organizationMember.deleteMany({ where: { orgId: org.id } });
  await db.organization.delete({ where: { id: org.id } });
  await db.user.deleteMany({
    where: { id: { in: [owner.id, buyer.id, manager.id] } },
  });
});
it("deduplicates concurrent full refunds, revokes entry, and reconciles provider success", async () => {
  const order = await booking();
  const before = await db.ticketType.findUniqueOrThrow({
    where: { id: type.id },
  });
  const input = {
    orderId: order.id,
    reason: "Customer requested cancellation",
  };
  const [first, second] = await Promise.all([
    refundBooking(owner.id, event.id, input, provider),
    refundBooking(owner.id, event.id, input, provider),
  ]);
  expect(first.refundId).toBe(second.refundId);
  expect(
    await db.refund.count({ where: { payment: { orderId: order.id } } }),
  ).toBe(1);
  expect(
    (await db.ticketType.findUniqueOrThrow({ where: { id: type.id } }))
      .quantitySold,
  ).toBe(before.quantitySold - 1);
  await retryRefunds(provider, order.id);
  expect(
    (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
  ).toBe("REFUNDED");
  expect(
    (await db.ticket.findFirstOrThrow({ where: { orderId: order.id } })).status,
  ).toBe("REFUNDED");
  const outbox = await db.webhookEvent.findFirstOrThrow({
    where: {
      provider: "operations-email",
      idempotencyKey: `refund-${first.refundId}-SUCCESS`,
    },
  });
  const send = vi.fn();
  await processOperationsEmail(outbox.payload, outbox.idempotencyKey, { send });
  expect(send.mock.calls[0][0].to).toBe(buyer.email);
  expect(send.mock.calls[0][0].text).toContain("confirmed by Cashfree");
  expect(send.mock.calls[0][0].idempotencyKey).toBe(outbox.idempotencyKey);
  await processOperationsEmail(outbox.payload, `refund-${first.refundId}-FAILED`, { send });
  expect(send).toHaveBeenCalledTimes(1);
});
it("blocks managers and buyers from issuing financial refunds", async () => {
  const order = await booking();
  for (const user of [manager, buyer])
    await expect(
      refundBooking(
        user.id,
        event.id,
        { orderId: order.id, reason: "Not authorized" },
        provider,
      ),
    ).rejects.toThrow("Access denied");
  expect(
    (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
  ).toBe("PAID");
});
it("rejects expired refund windows before revoking any ticket", async () => {
  const order = await booking();
  await db.payment.updateMany({
    where: { orderId: order.id },
    data: { paidAt: new Date("2020-01-31T12:00:00Z") },
  });
  await expect(
    refundBooking(
      owner.id,
      event.id,
      { orderId: order.id, reason: "Window expiry test" },
      provider,
    ),
  ).rejects.toThrow("window has expired");
  expect(
    (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
  ).toBe("PAID");
  expect(
    (await db.ticket.findFirstOrThrow({ where: { orderId: order.id } })).status,
  ).toBe("VALID");
});
it("cancels free bookings once without contacting Cashfree", async () => {
  const order = await booking(true);
  const calls = provider.refunds.length;
  await refundBooking(
    owner.id,
    event.id,
    { orderId: order.id, reason: "Guest no longer attending" },
    provider,
  );
  await refundBooking(
    owner.id,
    event.id,
    { orderId: order.id, reason: "Guest no longer attending" },
    provider,
  );
  expect(provider.refunds.length).toBe(calls);
  expect(
    (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
  ).toBe("CANCELLED");
  expect(
    await db.webhookEvent.count({
      where: {
        provider: "operations-email",
        idempotencyKey: `booking-cancelled-${order.id}`,
      },
    }),
  ).toBe(1);
});
it("allows workspace finance members to refund without event management privileges", async () => {
  const order = await booking();
  await db.organizationMember.update({ where: { orgId_userId: { orgId: org.id, userId: manager.id } }, data: { role: "FINANCE" } });
  try {
    expect((await refundBooking(manager.id, event.id, { orderId: order.id, reason: "Finance authorized refund" }, provider)).refundId).toBeTruthy();
  } finally {
    await db.organizationMember.update({ where: { orgId_userId: { orgId: org.id, userId: manager.id } }, data: { role: "MANAGER" } });
  }
});
it("keeps failed provider requests durable and retries with the same refund ID", async () => {
  const order = await booking();
  const failed = new MockPaymentProvider();
  failed.refund = vi.fn().mockRejectedValue(new Error("Offline"));
  failed.getRefund = vi.fn().mockRejectedValue(new Error("Offline"));
  const result = await refundBooking(
    owner.id,
    event.id,
    { orderId: order.id, reason: "Provider outage retry test" },
    failed,
  );
  expect(
    (await db.refund.findUniqueOrThrow({ where: { id: result.refundId! } }))
      .status,
  ).toBe("FAILED");
  await retryRefunds(provider, order.id);
  expect(
    await db.refund.count({ where: { payment: { orderId: order.id } } }),
  ).toBe(1);
});
it("exports filtered attendee CSV safely and rejects unrelated users", async () => {
  const order = await booking(true);
  await db.ticket.updateMany({
    where: { orderId: order.id },
    data: { holderName: "=SUM(1,2)" },
  });
  auth.user.mockResolvedValue(owner);
  const params = Promise.resolve({ eventId: event.id });
  const response = await GET(
    new Request("https://raunak.example/export?q=SUM"),
    { params },
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toContain(`"'=SUM(1,2)"`);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  auth.user.mockResolvedValue(buyer);
  expect(
    (await GET(new Request("https://raunak.example/export"), { params }))
      .status,
  ).toBe(403);
});
it("queues a new receipt and ticket email when the organizer resends", async () => {
  const order = await booking(true);
  await resendOrderNotifications(buyer.id, order.id);
  await resendOrderNotifications(buyer.id, order.id);
  expect(await db.notificationLog.count({ where: { orderId: order.id, trigger: "ORDER_CONFIRMED", channel: "EMAIL" } })).toBe(2);
});
