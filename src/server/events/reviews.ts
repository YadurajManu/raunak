import { z } from "zod";
import { db } from "@/server/db/client";

export const eventReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    body: z
      .string()
      .trim()
      .max(1200)
      .optional()
      .transform((value) => value || null),
    firstTimerFriendly: z.boolean().nullable().optional().transform((value) => value ?? null),
    easyToReach: z.boolean().nullable().optional().transform((value) => value ?? null),
  })
  .strict();

export function isEventReviewOpen(
  event: {
    status: string;
    visibility: string;
    endsAt: Date;
    deletedAt: Date | null;
    isTest: boolean;
    orgStatus: string;
  },
  now = new Date(),
) {
  return (
    (event.status === "PUBLISHED" || event.status === "ENDED") &&
    event.visibility === "PUBLIC" &&
    event.endsAt <= now &&
    event.deletedAt === null &&
    !event.isTest &&
    event.orgStatus === "ACTIVE"
  );
}

function reviewerName(name: string | null) {
  return name?.trim().split(/\s+/)[0] || "Attendee";
}

export async function eventReviewSnapshot(
  event: {
    id: string;
    status: string;
    visibility: string;
    endsAt: Date;
    deletedAt: Date | null;
    isTest: boolean;
    org: { status: string };
  },
  userId: string | null,
  now = new Date(),
) {
  const open = isEventReviewOpen({ ...event, orgStatus: event.org.status }, now);
  const [rows, aggregate, ownReview, qualifyingTicket] = await Promise.all([
    db.eventReview.findMany({
      where: { eventId: event.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 12,
      include: { user: { select: { name: true } } },
    }),
    db.eventReview.aggregate({
      where: { eventId: event.id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    userId
      ? db.eventReview.findUnique({
          where: { eventId_userId: { eventId: event.id, userId } },
        })
      : Promise.resolve(null),
    userId && open
      ? db.ticket.findFirst({
          where: {
            eventId: event.id,
            status: { in: ["VALID", "USED"] },
            order: {
              buyerId: userId,
              status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
            },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const canReview = Boolean(qualifyingTicket);
  return {
    reviews: rows.map((review) => ({
      id: review.id,
      name: reviewerName(review.user.name),
      rating: review.rating,
      body: review.body,
      firstTimerFriendly: review.firstTimerFriendly,
      easyToReach: review.easyToReach,
      createdAt: review.createdAt.toISOString(),
      isMine: review.userId === userId,
    })),
    averageRating: aggregate._avg.rating,
    reviewCount: aggregate._count._all,
    canReview,
    ownReview:
      canReview && ownReview
        ? {
            rating: ownReview.rating,
            body: ownReview.body || "",
            firstTimerFriendly: ownReview.firstTimerFriendly,
            easyToReach: ownReview.easyToReach,
          }
        : null,
    reviewOpen: open,
  };
}

export class EventReviewError extends Error {
  constructor(readonly status: 403 | 404 | 409, message: string) {
    super(message);
    this.name = "EventReviewError";
  }
}

export async function saveEventReview(
  eventId: string,
  userId: string,
  input: unknown,
  now = new Date(),
) {
  const review = eventReviewSchema.parse(input);
  const event = await db.event.findFirst({
    where: {
      id: eventId,
      status: { in: ["PUBLISHED", "ENDED"] },
      visibility: "PUBLIC",
      deletedAt: null,
      isTest: false,
      org: { status: "ACTIVE" },
    },
    select: {
      id: true,
      status: true,
      visibility: true,
      endsAt: true,
      deletedAt: true,
      isTest: true,
      org: { select: { status: true } },
    },
  });
  if (!event) throw new EventReviewError(404, "This event is unavailable for reviews.");
  if (!isEventReviewOpen({ ...event, orgStatus: event.org.status }, now))
    throw new EventReviewError(409, "Reviews open after the event ends.");

  const qualifyingTicket = await db.ticket.findFirst({
    where: {
      eventId,
      status: { in: ["VALID", "USED"] },
      order: {
        buyerId: userId,
        status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
      },
    },
    select: { id: true },
  });
  if (!qualifyingTicket)
    throw new EventReviewError(403, "A paid booking is required to review this event.");

  await db.eventReview.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, ...review },
    update: review,
  });
}
