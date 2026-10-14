import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { discoverPage, publicEvent } from "@/server/public/events";
import { walletWhere } from "@/lib/wallet";
import { createCheckout } from "@/server/checkout/service";

const key = randomUUID();
let orgId: string, userId: string, otherId: string;
const ids: string[] = [];
beforeAll(async () => {
  const org = await db.organization.create({ data: { name: key, slug: key } });
  orgId = org.id;
  const user = await db.user.create({
    data: { firebaseUid: key, email: `${key}@example.test` },
  });
  userId = user.id;
  const other = await db.user.create({
    data: { firebaseUid: `${key}-other`, email: `other-${key}@example.test` },
  });
  otherId = other.id;
  for (let i = 0; i < 14; i++) {
    const event = await db.event.create({
      data: {
        orgId,
        title: `${key} ${i}`,
        slug: `${key}-${i}`,
        category: i % 2 ? "Music" : "Arts",
        mode: i === 0 ? "ONLINE" : i === 2 ? "HYBRID" : "IN_PERSON",
        city: "Pune",
        venueName: "River Hall",
        lat: 18.52,
        lng: 73.85,
        startsAt: new Date(Date.now() + (i + 2) * 86400000),
        endsAt: new Date(Date.now() + (i + 2) * 86400000 + 3600000),
        status: "PUBLISHED",
        ticketTypes: {
          create: { name: "General", pricePaise: i * 10000, quantityTotal: 10 },
        },
      },
    });
    ids.push(event.id);
  }
});
afterAll(async () => {
  if (orgId) {
    await db.ticket.deleteMany({ where: { eventId: { in: ids } } });
    await db.order.deleteMany({ where: { eventId: { in: ids } } });
    await db.event.deleteMany({ where: { orgId } });
    await db.organization.delete({ where: { id: orgId } });
  }
  await db.user.deleteMany({
    where: { id: { in: [userId, otherId].filter(Boolean) } },
  });
});
it("queries real server filters independently and together with stable pagination", async () => {
  const query = (f = {}) => discoverPage({ q: key, ...f });
  expect((await query()).events).toHaveLength(12);
  expect((await query({ page: 2 })).events).toHaveLength(2);
  expect((await query({ city: "Delhi" })).total).toBe(0);
  expect((await query({ city: "pune" })).total).toBe(14);
  expect((await query({ category: "Music" })).total).toBe(7);
  expect((await query({ category: "Music|Arts" })).total).toBe(14);
  expect((await query({ price: "free" })).total).toBe(1);
  expect((await query({ price: "paid" })).total).toBe(13);
  expect((await query({ mode: "ONLINE" })).total).toBe(1);
  expect((await query({ mode: "HYBRID" })).total).toBe(1);
  expect((await query({ mode: "IN_PERSON" })).total).toBe(12);
  expect((await query({ lat: 18.52, lng: 73.85, radius: 5 })).total).toBe(13);
  expect((await query({ lat: 28.6, lng: 77.2, radius: 5 })).total).toBe(0);
  expect((await query({ period: "today" })).total).toBe(0);
  expect((await query({ from: "2099-01-01", to: "2099-01-02" })).total).toBe(0);
  expect(
    (
      await query({
        category: "Music",
        city: "Pune",
        price: "paid",
        min: 250,
        max: 550,
        mode: "IN_PERSON",
      })
    ).total,
  ).toBe(2);
  expect((await query({ sort: "price-desc" })).events[0].id).toBe(ids[13]);
  expect((await query({ sort: "price" })).events[0].id).toBe(ids[0]);
  expect((await query({ organizer: key })).total).toBe(14);
  expect((await query({ q: "' OR 1=1 --" })).total).toBe(0);
});
it("hides non-public and test events and blocks direct checkout for tests", async () => {
  for (const data of [
    { visibility: "UNLISTED" as const },
    { status: "DRAFT" as const },
    { status: "CANCELLED" as const },
    { isTest: true },
    { deletedAt: new Date() },
  ]) {
    await db.event.update({ where: { id: ids[0] }, data });
    expect((await discoverPage({ q: key })).total).toBe(13);
    await db.event.update({
      where: { id: ids[0] },
      data: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isTest: false,
        deletedAt: null,
      },
    });
  }
  await db.event.update({ where: { id: ids[0] }, data: { isTest: true } });
  expect(await publicEvent(`${key}-0`)).toBeNull();
  const type = await db.ticketType.findFirstOrThrow({
    where: { eventId: ids[0] },
  });
  await expect(
    createCheckout(
      { id: userId, email: `${key}@example.test` },
      {
        eventId: ids[0],
        buyerName: "Test Buyer",
        buyerPhone: "9876543210",
        idempotencyKey: randomUUID(),
        items: [{ ticketTypeId: type.id, quantity: 1 }],
      },
    ),
  ).rejects.toThrow("unavailable");
  await db.event.update({ where: { id: ids[0] }, data: { isTest: false } });
});
it("persists saves idempotently and classifies owned admission tickets accurately", async () => {
  const where = { userId_eventId: { userId, eventId: ids[0] } };
  for (let i = 0; i < 2; i++)
    await db.savedEvent.upsert({
      where,
      create: { userId, eventId: ids[0] },
      update: {},
    });
  expect(await db.savedEvent.count({ where: { userId } })).toBe(1);
  expect(await db.savedEvent.count({ where: { userId: otherId } })).toBe(0);
  const type = await db.ticketType.findFirstOrThrow({
    where: { eventId: ids[0] },
  });
  const order = await db.order.create({
    data: {
      eventId: ids[0],
      buyerId: userId,
      buyerName: "Buyer",
      buyerEmail: `${key}@example.test`,
      idempotencyKey: randomUUID(),
      status: "PAID",
      subtotalPaise: 0,
      feePaise: 0,
      totalPaise: 0,
      expiresAt: new Date(),
    },
  });
  const ticket = await db.ticket.create({
    data: {
      orderId: order.id,
      eventId: ids[0],
      ticketTypeId: type.id,
      code: key,
      holderName: "Buyer",
      holderEmail: `${key}@example.test`,
    },
  });
  expect(
    await db.ticket.count({ where: walletWhere(userId, "upcoming") }),
  ).toBe(1);
  expect(
    await db.ticket.count({ where: walletWhere(otherId, "upcoming") }),
  ).toBe(0);
  expect(
    await db.ticket.count({
      where: walletWhere(userId, "past", "", new Date("2099-01-01")),
    }),
  ).toBe(1);
  expect(
    await db.ticket.count({
      where: walletWhere(userId, "upcoming", "not-present"),
    }),
  ).toBe(0);
  await db.ticket.update({
    where: { id: ticket.id },
    data: { status: "CANCELLED" },
  });
  expect(
    await db.ticket.count({ where: walletWhere(userId, "cancelled") }),
  ).toBe(1);
  expect(
    await db.ticket.count({ where: walletWhere(userId, "upcoming") }),
  ).toBe(0);
  await db.order.update({
    where: { id: order.id },
    data: { status: "REFUNDED" },
  });
  expect(
    await db.ticket.count({ where: walletWhere(userId, "refunded") }),
  ).toBe(1);
  expect(
    await db.ticket.count({ where: walletWhere(userId, "cancelled") }),
  ).toBe(0);
});
