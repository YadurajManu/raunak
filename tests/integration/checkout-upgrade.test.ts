import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { createCheckout, applyPayment } from "@/server/checkout/service";
import { quoteCheckout } from "@/server/checkout/quote";
import { checkoutSnapshot } from "@/server/checkout/response";
import { MockPaymentProvider } from "@/server/providers/payments/mock";
vi.mock("@/server/tickets/delivery", () => ({ queueTicketDelivery: vi.fn() }));

it("quotes without holds, persists consent and attendee names, protects ownership and issues free and paid tickets", async () => {
  const uid = randomUUID();
  const org = await db.organization.create({
    data: {
      name: "Checkout upgrade",
      slug: uid,
      feeMode: "PASS_TO_BUYER",
      platformFeeBps: 1000,
    },
  });
  const buyer = await db.user.create({
    data: { firebaseUid: uid, email: `${uid}@example.test` },
  });
  const event = await db.event.create({
    data: {
      orgId: org.id,
      slug: uid,
      title: "Upgrade test",
      status: "PUBLISHED",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
    },
  });
  try {
    const type = await db.ticketType.create({
      data: {
        eventId: event.id,
        name: "General",
        pricePaise: 1000,
        quantityTotal: 20,
        maxPerOrder: 10,
      },
    });
    const selection = {
      eventId: event.id,
      items: [{ ticketTypeId: type.id, quantity: 2 }],
    };
    const quote = await quoteCheckout({ ...selection, totalPaise: 1 });
    expect(quote.totalPaise).toBe(2200);
    expect(
      (await db.ticketType.findUniqueOrThrow({ where: { id: type.id } }))
        .quantityHeld,
    ).toBe(0);
    await expect(
      createCheckout(buyer, {
        ...selection,
        buyerName: "Test Buyer",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow("Indian mobile");
    const provider = new MockPaymentProvider();
    const input = {
      ...selection,
      buyerName: "Test Buyer",
      buyerPhone: "9876543210",
      whatsappOptIn: true,
      attendeeNames: ["First Person", "Second Person"],
      idempotencyKey: randomUUID(),
    };
    const order = await createCheckout(buyer, input, provider);
    expect(order.whatsappOptInAt).toBeInstanceOf(Date);
    expect(order.buyerPhone).toBe("+919876543210");
    expect((await createCheckout(buyer, input, provider)).id).toBe(order.id);
    await expect(
      createCheckout(
        buyer,
        { ...input, attendeeNames: ["Changed Person", "Second Person"] },
        provider,
      ),
    ).rejects.toThrow("Idempotency");
    expect(await checkoutSnapshot(order.id, randomUUID())).toBeNull();
    const snapshot = await checkoutSnapshot(order.id, buyer.id);
    expect(snapshot?.totalPaise).toBe(quote.totalPaise);
    expect(snapshot).not.toHaveProperty("idempotencyKey");
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
    expect(
      (
        await db.ticket.findMany({
          where: { orderId: order.id },
          orderBy: { holderName: "asc" },
        })
      ).map((ticket) => ticket.holderName),
    ).toEqual(["First Person", "Second Person"]);
    await db.ticketType.update({
      where: { id: type.id },
      data: { pricePaise: 0 },
    });
    const free = await createCheckout(
      buyer,
      {
        ...selection,
        buyerName: "Email Buyer",
        attendeeNames: ["Free Person", "Free Friend"],
        idempotencyKey: randomUUID(),
      },
      provider,
    );
    expect(free.status).toBe("PAID");
    expect(free.buyerPhone).toBeNull();
    expect(free.whatsappOptInAt).toBeNull();
    expect(
      await db.ticket.count({
        where: { orderId: free.id, holderName: "Free Friend" },
      }),
    ).toBe(1);
    await db.ticketType.update({
      where: { id: type.id },
      data: { quantityTotal: 4 },
    });
    await expect(quoteCheckout(selection)).rejects.toThrow("tickets left");
  } finally {
    const orders = { order: { eventId: event.id } };
    await db.payment.deleteMany({ where: orders });
    await db.ticket.deleteMany({ where: { eventId: event.id } });
    await db.orderItem.deleteMany({ where: orders });
    await db.order.deleteMany({ where: { eventId: event.id } });
    await db.ticketType.deleteMany({ where: { eventId: event.id } });
    await db.event.delete({ where: { id: event.id } });
    await db.organization.delete({ where: { id: org.id } });
    await db.user.delete({ where: { id: buyer.id } });
  }
});
