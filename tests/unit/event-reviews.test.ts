import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  ticketFindFirst: vi.fn(),
  reviewUpsert: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  db: {
    event: { findFirst: mocks.eventFindFirst },
    ticket: { findFirst: mocks.ticketFindFirst },
    eventReview: { upsert: mocks.reviewUpsert },
  },
}));

import {
  EventReviewError,
  eventReviewSchema,
  isEventReviewOpen,
  saveEventReview,
} from "@/server/events/reviews";

const endedEvent = {
  id: "event-id",
  status: "PUBLISHED",
  visibility: "PUBLIC",
  endsAt: new Date("2026-10-18T18:00:00Z"),
  deletedAt: null,
  isTest: false,
  org: { status: "ACTIVE" },
};
const now = new Date("2026-10-19T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventFindFirst.mockResolvedValue(endedEvent);
  mocks.ticketFindFirst.mockResolvedValue({ id: "ticket-id" });
  mocks.reviewUpsert.mockResolvedValue({ id: "review-id" });
});

it("accepts a bounded rating and normalizes optional attendee notes", () => {
  expect(
    eventReviewSchema.parse({
      rating: 5,
      body: "  Lovely night  ",
      firstTimerFriendly: true,
    }),
  ).toEqual({
    rating: 5,
    body: "Lovely night",
    firstTimerFriendly: true,
    easyToReach: null,
  });
  expect(eventReviewSchema.safeParse({ rating: 0 }).success).toBe(false);
  expect(eventReviewSchema.safeParse({ rating: 6 }).success).toBe(false);
  expect(eventReviewSchema.safeParse({ rating: 4, extra: "email" }).success).toBe(false);
});

it("opens reviews only after a real public event ends", () => {
  expect(isEventReviewOpen({ ...endedEvent, orgStatus: "ACTIVE" }, now)).toBe(true);
  expect(
    isEventReviewOpen(
      { ...endedEvent, endsAt: new Date("2026-10-20T00:00:00Z"), orgStatus: "ACTIVE" },
      now,
    ),
  ).toBe(false);
  expect(
    isEventReviewOpen({ ...endedEvent, isTest: true, orgStatus: "ACTIVE" }, now),
  ).toBe(false);
});

it("requires a qualifying booking before writing a review", async () => {
  mocks.ticketFindFirst.mockResolvedValue(null);

  await expect(saveEventReview("event-id", "buyer-id", { rating: 5 }, now)).rejects.toBeInstanceOf(
    EventReviewError,
  );
  expect(mocks.reviewUpsert).not.toHaveBeenCalled();
});

it("upserts one review for the verified event and attendee pair", async () => {
  await saveEventReview(
    "event-id",
    "buyer-id",
    { rating: 4, body: "Easy to find", easyToReach: true },
    now,
  );

  expect(mocks.ticketFindFirst).toHaveBeenCalledWith({
    where: {
      eventId: "event-id",
      status: { in: ["VALID", "USED"] },
      order: {
        buyerId: "buyer-id",
        status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
      },
    },
    select: { id: true },
  });
  expect(mocks.reviewUpsert).toHaveBeenCalledWith({
    where: { eventId_userId: { eventId: "event-id", userId: "buyer-id" } },
    create: {
      eventId: "event-id",
      userId: "buyer-id",
      rating: 4,
      body: "Easy to find",
      firstTimerFriendly: null,
      easyToReach: true,
    },
    update: {
      rating: 4,
      body: "Easy to find",
      firstTimerFriendly: null,
      easyToReach: true,
    },
  });
});
