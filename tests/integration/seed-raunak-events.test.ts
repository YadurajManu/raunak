/* eslint-disable @typescript-eslint/no-require-imports */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { listEvents } from "@/server/events/service";
import { discoverPage, publicEvent } from "@/server/public/events";
import { createCheckout, applyPayment } from "@/server/checkout/service";
import { MockPaymentProvider } from "@/server/providers/payments/mock";
vi.mock("@/server/tickets/delivery", () => ({ queueTicketDelivery: vi.fn() }));
const seed = require("../../seed-raunak-events.js");
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw Error("Seed integration tests require a local test database.");
const key = randomUUID();
const emails = [
  `seed-owner-a-${key}@example.test`,
  `seed-owner-b-${key}@example.test`,
];
const env = {
  ...process.env,
  APP_URL: "http://localhost:3105",
  NODE_ENV: "test",
  CASHFREE_ENV: "sandbox",
  SEED_ALLOW_PUBLISH: "true",
  SEED_ORGANIZER_EMAILS: emails.join(","),
};
const config = seed.options(env, ["--apply"]);
const events = seed.buildEvents(config);
const ids = events.map((e: { id: string }) => e.id);
const orgIds: string[] = [],
  userIds: string[] = [],
  otherIds: string[] = [];
const provider = new MockPaymentProvider();
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  // Only records belonging to this test's workspaces are removed.
  const eventWhere = { orgId: { in: orgIds } };
  const orderWhere = { order: { event: eventWhere } };
  await db.refund.deleteMany({ where: { payment: orderWhere } });
  await db.payment.deleteMany({ where: orderWhere });
  await db.ticket.deleteMany({ where: { event: eventWhere } });
  await db.orderItem.deleteMany({ where: orderWhere });
  await db.order.deleteMany({ where: { event: eventWhere } });
  await db.ticketType.deleteMany({ where: { event: eventWhere } });
  await db.event.deleteMany({ where: eventWhere });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

it("seeds transactionally under existing owners, stays idempotent, verifies and cleans up safely", async () => {
  // Deterministic seed IDs must never clobber a developer's prior seed run.
  expect(await db.event.count({ where: { id: { in: ids } } })).toBe(0);
  for (const email of emails) {
    const user = await db.user.create({
      data: { email, firebaseUid: `fixture-${randomUUID()}` },
    });
    userIds.push(user.id);
    const org = await db.organization.create({
      data: {
        name: "Seed integration fixture",
        slug: `seed-fixture-${randomUUID()}`,
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    orgIds.push(org.id);
  }
  const log = vi.fn();
  await seed.run({ ...config, apply: false }, env, log);
  expect(await db.event.count({ where: { id: { in: ids } } })).toBe(0);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(null, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
    ),
  );

  // A media-key conflict after the first INSERT must roll back the entire seed.
  const other = await db.event.create({
    data: {
      orgId: orgIds[0],
      slug: `seed-collision-${key}`,
      title: "Fixture",
      startsAt: new Date("2030-01-01"),
      endsAt: new Date("2030-01-02"),
      images: {
        create: {
          kind: "POSTER",
          storageKey: events[0].images[0].storageKey,
          mime: "image/jpeg",
          sizeBytes: 1,
        },
      },
    },
  });
  otherIds.push(other.id);
  await expect(seed.run(config, env, log)).rejects.toMatchObject({
    code: "23505",
  });
  expect(await db.event.count({ where: { id: { in: ids } } })).toBe(0);
  await db.event.delete({ where: { id: other.id } });

  await seed.run(config, env, log);
  const created = await db.event.findMany({
    where: { id: { in: ids } },
    include: { images: true, ticketTypes: true },
  });
  expect(created).toHaveLength(12);
  expect(
    created.every(
      (e) =>
        e.isTest &&
        e.status === "DRAFT" &&
        e.images.length === 4 &&
        e.ticketTypes.length === 3,
    ),
  ).toBe(true);
  const countByOwner = await Promise.all(
    orgIds.map((orgId, i) => listEvents(userIds[i], orgId)),
  );
  expect(
    countByOwner.map((rows) => rows.filter((e) => ids.includes(e.id)).length),
  ).toEqual([6, 6]);
  expect(await publicEvent(events[0].slug)).toBeNull();
  const original = created[0];
  await db.event.update({
    where: { id: original.id },
    data: { summary: "Organizer edit — preserve this" },
  });
  await seed.run(config, env, log);
  expect(await db.event.count({ where: { id: { in: ids } } })).toBe(12);
  expect(
    (await db.event.findUniqueOrThrow({ where: { id: original.id } })).summary,
  ).toBe("Organizer edit — preserve this");
  await seed.run({ ...config, apply: false, verify: true }, env, log);
  await seed.run({ ...config, cleanup: true }, env, log);
  expect(await db.event.count({ where: { id: { in: ids } } })).toBe(0);

  const published = { ...config, publish: true };
  await seed.run(published, env, log);
  const listing = await publicEvent(events[1].slug);
  expect(listing?.images).toHaveLength(4);
  expect(listing?.ticketTypes).toHaveLength(3);
  const found = await discoverPage({ q: "[DEMO]", limit: 24 });
  expect(found.events.filter((e) => ids.includes(e.id))).toHaveLength(12);

  vi.stubEnv("CASHFREE_ENV", "sandbox");
  const cart = (index: number, tier: number) => ({
    eventId: events[index].id,
    items: [{ ticketTypeId: events[index].ticketTypes[tier].id, quantity: 2 }],
    buyerName: "Seed integration buyer",
    buyerPhone: "9876543210",
    idempotencyKey: randomUUID(),
  });
  const buyer = { id: userIds[0], email: emails[0] };
  const free = await createCheckout(buyer, cart(3, 0), {
    ...provider,
    createOrder: vi.fn(() => {
      throw Error("Free checkout called payment gateway");
    }),
  } as unknown as MockPaymentProvider);
  expect(free.status).toBe("PAID");
  expect(free.totalPaise).toBe(0);
  expect(await db.ticket.count({ where: { orderId: free.id } })).toBe(2);
  const paidCart = cart(0, 0);
  const paid = await createCheckout(buyer, paidCart, provider);
  expect(paid.totalPaise).toBe(39800);
  expect(paid.paymentSessionId).toMatch(/^mock_/);
  const payment = {
    id: `seed-mock-${key}`,
    amountPaise: paid.totalPaise,
    status: "SUCCESS" as const,
    raw: { testOnly: true },
  };
  await applyPayment(paid.id, payment, provider);
  await applyPayment(paid.id, payment, provider);
  expect(await db.ticket.count({ where: { orderId: paid.id } })).toBe(2);
  vi.stubEnv("CASHFREE_ENV", "production");
  await expect(createCheckout(buyer, cart(0, 0), provider)).rejects.toThrow(
    "sandbox",
  );
  await expect(createCheckout(buyer, paidCart, provider)).rejects.toThrow(
    "sandbox",
  );
  await expect(
    seed.run({ ...config, cleanup: true }, env, log),
  ).rejects.toThrow("Cleanup refused");
  expect(await db.event.count({ where: { id: { in: ids } } })).toBe(12);
}, 30000);
