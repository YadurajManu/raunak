import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it, vi } from "vitest";
const { current } = vi.hoisted(() => ({ current: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ currentUser: current }));
vi.mock("@/server/tickets/delivery", () => ({ queueTicketDelivery: vi.fn() }));
import { db } from "@/server/db/client";
import { storage } from "@/server/providers/storage/s3";
import { createCheckout } from "@/server/checkout/service";
import { prepareTicketPdfs } from "@/server/tickets/pdf";
import { GET } from "../../src/app/api/tickets/[id]/pdf/route";
const key = randomUUID();
const org = await db.organization.create({
  data: { name: "PDF test", slug: `pdf-${key}` },
});
const buyer = await db.user.create({
  data: { firebaseUid: `pdf-${key}`, email: `pdf-${key}@example.test` },
});
const event = await db.event.create({
  data: {
    orgId: org.id,
    slug: `pdf-${key}`,
    title: "A Raunak gathering",
    status: "PUBLISHED",
    startsAt: new Date(Date.now() + 86400000),
    endsAt: new Date(Date.now() + 90000000),
  },
});
const type = await db.ticketType.create({
  data: { eventId: event.id, name: "Guest", pricePaise: 0, quantityTotal: 10 },
});
const files: string[] = [];
afterAll(async () => {
  for (const file of files) await storage.delete(file);
  await db.ticket.deleteMany({ where: { eventId: event.id } });
  await db.orderItem.deleteMany({ where: { order: { eventId: event.id } } });
  await db.order.deleteMany({ where: { eventId: event.id } });
  await db.ticketType.delete({ where: { id: type.id } });
  await db.event.delete({ where: { id: event.id } });
  await db.organization.delete({ where: { id: org.id } });
  await db.user.delete({ where: { id: buyer.id } });
  vi.unstubAllEnvs();
});
it("generates a private Unicode-capable PDF and restricts downloads to the buyer", async () => {
  vi.stubEnv(
    "TICKET_SIGNING_SECRET",
    "test-ticket-signing-secret-at-least-32-characters",
  );
  const order = await createCheckout(buyer, {
    eventId: event.id,
    items: [{ ticketTypeId: type.id, quantity: 1 }],
    buyerName: "शुभम सिंह",
    buyerPhone: "9876543210",
    idempotencyKey: randomUUID(),
  });
  await prepareTicketPdfs(order.id);
  const ticket = await db.ticket.findFirstOrThrow({
    where: { orderId: order.id },
  });
  expect(ticket.pdfKey).toBeTruthy();
  files.push(ticket.pdfKey!);
  current.mockResolvedValue({ id: randomUUID() });
  expect(
    (
      await GET(new Request("https://raunak.example"), {
        params: Promise.resolve({ id: ticket.id }),
      })
    ).status,
  ).toBe(404);
  current.mockResolvedValue({ id: buyer.id });
  const response = await GET(new Request("https://raunak.example"), {
    params: Promise.resolve({ id: ticket.id }),
  });
  expect(response.status).toBe(200);
  const pdf = Buffer.from(await response.arrayBuffer());
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.length).toBeGreaterThan(5000);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  // LocalStack does not enforce bucket IAM; the API ownership check above is authoritative here.

});
