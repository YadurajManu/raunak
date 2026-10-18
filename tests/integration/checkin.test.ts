import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { checkIn, searchAttendees } from "@/server/checkin/service";
import { ticketToken } from "@/server/tickets/qr";

const key = randomUUID();
let owner: string,
  staff: string,
  org: string,
  event: string,
  otherEvent: string,
  type: string;
const users: string[] = [],
  orders: string[] = [];
beforeAll(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3105");
  vi.stubEnv(
    "TICKET_SIGNING_SECRET",
    "checkin-integration-secret-longer-than-32-characters",
  );
  for (const name of ["Owner", "Door Staff"])
    users.push(
      (
        await db.user.create({
          data: {
            firebaseUid: `${key}-${name}`,
            email: `${name.replaceAll(" ", "-")}-${key}@example.test`,
            name,
          },
        })
      ).id,
    );
  [owner, staff] = users;
  org = (
    await db.organization.create({
      data: {
        name: key,
        slug: key,
        members: {
          create: [
            { userId: owner, role: "OWNER" },
            { userId: staff, role: "CHECKIN" },
          ],
        },
      },
    })
  ).id;
  for (const suffix of ["main", "other"]) {
    const created = await db.event.create({
      data: {
        orgId: org,
        title: `${key}-${suffix}`,
        slug: `${key}-${suffix}`,
        status: "PUBLISHED",
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
      },
    });
    if (suffix === "main") event = created.id;
    else otherEvent = created.id;
  }
  type = (
    await db.ticketType.create({
      data: {
        eventId: event,
        name: "General admission",
        pricePaise: 0,
        quantityTotal: 100,
      },
    })
  ).id;
});
afterAll(async () => {
  if (org) {
    await db.auditLog.deleteMany({ where: { orgId: org } });
    await db.ticket.deleteMany({
      where: { eventId: { in: [event, otherEvent].filter(Boolean) } },
    });
    await db.order.deleteMany({ where: { id: { in: orders } } });
    await db.ticketType.deleteMany({ where: { eventId: event } });
    await db.eventStaff.deleteMany({
      where: { eventId: { in: [event, otherEvent].filter(Boolean) } },
    });
    await db.event.deleteMany({ where: { orgId: org } });
    await db.organizationMember.deleteMany({ where: { orgId: org } });
    await db.organization.delete({ where: { id: org } });
  }
  await db.user.deleteMany({ where: { id: { in: users } } });
  vi.unstubAllEnvs();
});
async function ticket(name = "Aditi Sharma") {
  const order = await db.order.create({
    data: {
      eventId: event,
      buyerId: owner,
      buyerName: name,
      buyerEmail: `${key}@example.test`,
      status: "PAID",
      subtotalPaise: 0,
      feePaise: 0,
      totalPaise: 0,
      idempotencyKey: randomUUID(),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  orders.push(order.id);
  return db.ticket.create({
    data: {
      eventId: event,
      orderId: order.id,
      ticketTypeId: type,
      code: randomUUID().slice(0, 10),
      holderName: name,
      holderEmail: `${key}@example.test`,
      holderPhone: "+919876543210",
    },
  });
}
it("admits only once under simultaneous scans and returns the original entry details", async () => {
  const item = await ticket();
  const input = { eventId: event, token: ticketToken(item.id, event) };
  const results = await Promise.all(
    Array.from({ length: 4 }, () => checkIn(owner, input)),
  );
  expect(results.filter((value) => value.result === "VALID")).toHaveLength(1);
  expect(
    results.filter((value) => value.result === "ALREADY_USED"),
  ).toHaveLength(3);
  expect(
    new Set(results.map((value) => value.ticket?.checkedInAt?.toISOString()))
      .size,
  ).toBe(1);
  expect(results[1].ticket?.checkedInBy?.name).toBe("Owner");
  expect(
    (await db.auditLog.findMany({ where: { entityId: item.id } })).length,
  ).toBe(4);
});
it("rejects forged QR codes, wrong events, foreign ticket links and ambiguous input", async () => {
  const item = await ticket();
  const token = ticketToken(item.id, event);
  for (const value of [
    token.replace(/.$/, token.endsWith("A") ? "B" : "A"),
    `https://untrusted.example/t/${token}`,
    "not-a-ticket",
  ]) {
    expect(
      await checkIn(owner, { eventId: event, token: value }),
    ).toMatchObject({ result: "INVALID", ticket: null });
  }
  expect(await checkIn(owner, { eventId: otherEvent, token })).toMatchObject({
    result: "INVALID",
    ticket: null,
  });
  await expect(
    checkIn(owner, { eventId: event, token, ticketId: item.id }),
  ).rejects.toThrow();
  expect(
    (await db.ticket.findUniqueOrThrow({ where: { id: item.id } })).status,
  ).toBe("VALID");
});
it("accepts canonical ticket links and manual lookup through the same validation", async () => {
  const first = await ticket(),
    second = await ticket();
  expect(
    (
      await checkIn(owner, {
        eventId: event,
        token: ` http://localhost:3105/t/${ticketToken(first.id, event)} `,
      })
    ).result,
  ).toBe("VALID");
  expect(
    (await checkIn(owner, { eventId: event, ticketId: second.id })).result,
  ).toBe("VALID");
});
it("never admits a cancelled ticket or an unpaid/refunded booking", async () => {
  const cancelled = await ticket();
  await db.ticket.update({
    where: { id: cancelled.id },
    data: { status: "CANCELLED" },
  });
  expect(
    (await checkIn(owner, { eventId: event, ticketId: cancelled.id })).result,
  ).toBe("INVALID");
  const refunded = await ticket();
  await db.order.update({
    where: { id: refunded.orderId },
    data: { status: "REFUNDED" },
  });
  expect(
    (await checkIn(owner, { eventId: event, ticketId: refunded.id })).result,
  ).toBe("INVALID");
});
it("closes admission for cancelled events and suspended organizers", async () => {
  const item = await ticket();
  await db.event.update({
    where: { id: event },
    data: { status: "CANCELLED" },
  });
  expect(
    (await checkIn(owner, { eventId: event, ticketId: item.id })).result,
  ).toBe("INVALID");
  await db.event.update({
    where: { id: event },
    data: { status: "PUBLISHED" },
  });
  await db.organization.update({
    where: { id: org },
    data: { status: "SUSPENDED" },
  });
  expect(
    (await checkIn(owner, { eventId: event, ticketId: item.id })).result,
  ).toBe("INVALID");
  await db.organization.update({
    where: { id: org },
    data: { status: "ACTIVE" },
  });
});
it("requires check-in staff assignment and prevents cross-event manual entry", async () => {
  const item = await ticket();
  await expect(
    checkIn(staff, { eventId: event, ticketId: item.id }),
  ).rejects.toThrow("Access denied");
  await expect(
    searchAttendees(staff, { eventId: event, q: "Aditi" }),
  ).rejects.toThrow("Access denied");
  await db.eventStaff.create({
    data: { eventId: event, userId: staff, role: "CHECKIN" },
  });
  expect(
    (await checkIn(staff, { eventId: event, ticketId: item.id })).result,
  ).toBe("VALID");
  expect(
    (await checkIn(owner, { eventId: otherEvent, ticketId: item.id })).result,
  ).toBe("INVALID");
});
it("searches real booking IDs and includes cancelled matches with their actual status", async () => {
  const item = await ticket("Unique Lookup Guest");
  await db.order.update({
    where: { id: item.orderId },
    data: { status: "CANCELLED" },
  });
  for (const q of [item.orderId, item.code, "Unique Lookup", "9876543210"]) {
    const results = await searchAttendees(owner, { eventId: event, q });
    expect(
      results.some(
        (value) => value.id === item.id && value.order.status === "CANCELLED",
      ),
    ).toBe(true);
  }
});
