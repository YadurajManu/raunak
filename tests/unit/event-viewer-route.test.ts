import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  eventFindFirst: vi.fn(),
  ticketFindMany: vi.fn(),
  ticketFindFirst: vi.fn(),
  savedFindUnique: vi.fn(),
  followerCount: vi.fn(),
  followerFindUnique: vi.fn(),
  memberFindUnique: vi.fn(),
  reviewFindUnique: vi.fn(),
  access: vi.fn(),
  token: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({ currentUser: mocks.currentUser }));
vi.mock("@/server/db/client", () => ({
  db: {
    event: { findFirst: mocks.eventFindFirst },
  ticket: { findMany: mocks.ticketFindMany, findFirst: mocks.ticketFindFirst },
    savedEvent: { findUnique: mocks.savedFindUnique },
    organizationFollower: {
      count: mocks.followerCount,
      findUnique: mocks.followerFindUnique,
    },
    organizationMember: { findUnique: mocks.memberFindUnique },
    eventReview: { findUnique: mocks.reviewFindUnique },
  },
}));
vi.mock("@/server/rbac/access", () => ({
  requireEventAccessForUser: mocks.access,
}));
vi.mock("@/server/tickets/qr", () => ({ ticketToken: mocks.token }));

import { GET } from "@/app/api/events/[eventId]/viewer/route";

const eventId = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventFindFirst.mockResolvedValue({
    id: eventId,
    slug: "community-night",
    orgId: "00000000-0000-4000-8000-000000000002",
    mode: "IN_PERSON",
    onlineUrl: null,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    isTest: false,
    startsAt: new Date(Date.now() + 86400000),
    endsAt: new Date(Date.now() + 90000000),
  });
  mocks.currentUser.mockResolvedValue({ id: "viewer-1" });
  mocks.ticketFindMany.mockResolvedValue([{ id: "ticket-1" }]);
  mocks.ticketFindFirst.mockResolvedValue({ id: "ticket-1" });
  mocks.savedFindUnique.mockResolvedValue({ eventId });
  mocks.followerCount.mockResolvedValue(3);
  mocks.followerFindUnique.mockResolvedValue({ id: "follow-1" });
  mocks.memberFindUnique.mockResolvedValue({
    role: "MANAGER",
    status: "ACTIVE",
  });
  mocks.reviewFindUnique.mockResolvedValue(null);
  mocks.access.mockResolvedValue({ id: eventId });
  mocks.token.mockReturnValue("v1.signed-ticket-token");
});

it("returns no-store anonymous state without querying other attendees or team membership", async () => {
  mocks.currentUser.mockResolvedValue(null);
  const response = await GET(new Request("https://raunak.test"), {
    params: Promise.resolve({ eventId }),
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({
    authenticated: false,
    ticketCount: 0,
    teamRole: null,
  });
  expect(mocks.ticketFindMany).not.toHaveBeenCalled();
  expect(mocks.access).not.toHaveBeenCalled();
});

it("hides a draft event from viewers without event-team access", async () => {
  mocks.eventFindFirst.mockResolvedValue({
    id: eventId,
    slug: "private-draft",
    orgId: "00000000-0000-4000-8000-000000000002",
    mode: "IN_PERSON",
    onlineUrl: null,
    status: "DRAFT",
    visibility: "PUBLIC",
    isTest: false,
    startsAt: new Date(Date.now() + 86400000),
    endsAt: new Date(Date.now() + 90000000),
  });
  mocks.access.mockRejectedValue(new Error("Access denied"));
  const response = await GET(new Request("https://raunak.test"), {
    params: Promise.resolve({ eventId }),
  });
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.ticketFindMany).not.toHaveBeenCalled();
  expect(mocks.savedFindUnique).not.toHaveBeenCalled();
});

it("returns only the viewer's valid ticket summary and authorized team shortcuts", async () => {
  const response = await GET(new Request("https://raunak.test"), {
    params: Promise.resolve({ eventId }),
  });
  const body = await response.json();
  expect(body).toMatchObject({
    authenticated: true,
    saved: true,
    isFollowing: true,
    followerCount: 3,
    ticketCount: 1,
    ticketHref: "/t/v1.signed-ticket-token",
    teamRole: "MANAGER",
    managementLinks: {
      edit: `/dashboard/events/${eventId}/details`,
      orders: `/dashboard/events/${eventId}`,
      checkIn: `/dashboard/events/${eventId}/check-in`,
      preview: "/e/community-night?preview=visitor",
    },
  });
  expect(mocks.ticketFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        eventId,
        status: "VALID",
        order: {
          buyerId: "viewer-1",
          status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
        },
      }),
    }),
  );
  expect(JSON.stringify(body)).not.toMatch(
    /buyer|holderName|holderEmail|code|firebaseUid/i,
  );
});

it("does not expose management links when RBAC rejects the viewer", async () => {
  mocks.memberFindUnique.mockResolvedValue({
    role: "MANAGER",
    status: "ACTIVE",
  });
  mocks.access.mockRejectedValue(new Error("Access denied"));
  const response = await GET(new Request("https://raunak.test"), {
    params: Promise.resolve({ eventId }),
  });
  expect(await response.json()).toMatchObject({
    teamRole: null,
    managementLinks: null,
  });
});

it("does not show cancelled tickets or expose online join details without a valid ticket", async () => {
  mocks.ticketFindMany.mockResolvedValue([]);
  mocks.eventFindFirst.mockResolvedValue({
    id: eventId,
    slug: "online-event",
    orgId: "00000000-0000-4000-8000-000000000002",
    mode: "ONLINE",
    onlineUrl: "https://private.example.test/join",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    isTest: false,
    startsAt: new Date(Date.now() + 86400000),
    endsAt: new Date(Date.now() + 90000000),
  });
  const response = await GET(new Request("https://raunak.test"), {
    params: Promise.resolve({ eventId }),
  });
  const body = await response.json();
  expect(body.ticketCount).toBe(0);
  expect(body.onlineUrl).toBeNull();
});

it("allows an eligible attendee with a used ticket to review after the event without marking them as going", async () => {
  mocks.ticketFindMany.mockResolvedValue([]);
  mocks.eventFindFirst.mockResolvedValue({
    id: eventId,
    slug: "ended-event",
    orgId: "00000000-0000-4000-8000-000000000002",
    mode: "IN_PERSON",
    onlineUrl: null,
    status: "ENDED",
    visibility: "PUBLIC",
    isTest: false,
    startsAt: new Date(Date.now() - 90000000),
    endsAt: new Date(Date.now() - 86400000),
  });
  mocks.ticketFindFirst.mockResolvedValue({ id: "used-ticket" });
  const response = await GET(
    new Request("https://raunak.test"),
    { params: Promise.resolve({ eventId }) },
  );
  expect(await response.json()).toMatchObject({ ticketCount: 0, canReview: true });
});
