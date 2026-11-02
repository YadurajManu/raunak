import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  findTicket: vi.fn(),
  findTickets: vi.fn(),
  snapshot: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ currentUser: mocks.currentUser }));
vi.mock("@/server/db/client", () => ({
  db: { ticket: { findFirst: mocks.findTicket, findMany: mocks.findTickets } },
}));
vi.mock("@/server/checkout/response", () => ({
  checkoutSnapshot: mocks.snapshot,
  checkoutError: () => Response.json({ error: "unavailable" }, { status: 503 }),
}));
vi.mock("@/server/checkout/service", () => ({
  reconcileOrder: mocks.reconcile,
}));
import { mobileTicket } from "@/server/mobile/tickets";
import { GET as ticketGET } from "@/app/api/mobile/tickets/[id]/route";
import { GET as orderGET } from "@/app/api/mobile/orders/[id]/route";
const fixture = () => ({
  id: randomUUID(),
  code: "ADMISSION",
  orderId: randomUUID(),
  holderName: "Guest",
  status: "VALID",
  ticketType: { name: "Entry" },
  order: { status: "PAID", _count: { tickets: 2 } },
  event: {
    id: randomUUID(),
    slug: "test",
    title: "Event",
    startsAt: new Date(Date.now() + 86400000),
    endsAt: new Date(Date.now() + 90000000),
    timezone: "Asia/Kolkata",
    venueName: "Hall",
    address: null,
    city: "Delhi",
    mode: "IN_PERSON",
    status: "PUBLISHED",
    deletedAt: null,
    lat: null,
    lng: null,
    org: { name: "Host" },
    images: [],
  },
});
beforeEach(() => {
  vi.resetAllMocks();
  process.env.APP_URL = "https://raunak.example";
  process.env.TICKET_SIGNING_SECRET =
    "mobile-wallet-test-secret-at-least-32-characters";
  mocks.currentUser.mockResolvedValue({ id: "viewer" });
});
it("list DTOs never expose signed QR payloads; active owned details use the existing signed ticket URL", () => {
  const t = fixture();
  expect(mobileTicket(t)).not.toHaveProperty("qrPayload");
  const detail = mobileTicket(t, true);
  expect(detail.active).toBe(true);
  expect(detail.qrPayload).toContain(`/t/v1.${t.id}.`);
});
it("refunded,cancelled,used,past and unpaid tickets never receive a reusable QR", () => {
  for (const change of ["refunded", "cancelled", "used", "past", "unpaid"]) {
    const t = fixture();
    if (change === "refunded") t.status = "REFUNDED";
    if (change === "cancelled") t.event.status = "CANCELLED";
    if (change === "used") t.status = "USED";
    if (change === "past") t.event.endsAt = new Date(Date.now() - 1000);
    if (change === "unpaid") t.order.status = "PENDING";
    expect(mobileTicket(t, true).qrPayload).toBeNull();
    expect(mobileTicket(t, true).active).toBe(false);
  }
});
it("requires sign-in and enforces ticket ownership in the database query", async () => {
  const id = randomUUID(),
    context = { params: Promise.resolve({ id }) };
  mocks.currentUser.mockResolvedValueOnce(null);
  expect(
    (await ticketGET(new Request("https://raunak.example"), context)).status,
  ).toBe(401);
  mocks.findTicket.mockResolvedValue(null);
  expect(
    (await ticketGET(new Request("https://raunak.example"), context)).status,
  ).toBe(404);
  expect(mocks.findTicket.mock.calls[0][0].where).toEqual({
    id,
    order: { buyerId: "viewer" },
  });
});
it("returns each admission ticket and only siblings from the owned booking", async () => {
  const t = fixture();
  mocks.findTicket.mockResolvedValue(t);
  mocks.findTickets.mockResolvedValue([{ id: t.id, code: t.code }]);
  const response = await ticketGET(new Request("https://raunak.example"), {
    params: Promise.resolve({ id: t.id }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect((await response.json()).siblings).toHaveLength(1);
  expect(mocks.findTickets.mock.calls[0][0].where).toEqual({
    orderId: t.orderId,
    order: { buyerId: "viewer" },
  });
});
it("never reconciles a booking belonging to another account", async () => {
  mocks.snapshot.mockResolvedValue(null);
  const response = await orderGET(new Request("https://raunak.example"), {
    params: Promise.resolve({ id: randomUUID() }),
  });
  expect(response.status).toBe(404);
  expect(mocks.reconcile).not.toHaveBeenCalled();
});
it("provider failure remains pending with delayed verification rather than claiming success", async () => {
  mocks.snapshot.mockResolvedValue({ id: randomUUID(), status: "PENDING" });
  mocks.reconcile.mockRejectedValue(new Error("provider timeout"));
  const response = await orderGET(new Request("https://raunak.example"), {
    params: Promise.resolve({ id: randomUUID() }),
  });
  expect(await response.json()).toMatchObject({
    status: "PENDING",
    verificationDelayed: true,
  });
});
