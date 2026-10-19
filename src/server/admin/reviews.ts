import { z } from "zod";
import { db } from "@/server/db/client";
import { Prisma } from "@/generated/prisma/client";
import { assertEventCanBePublished } from "@/server/events/publication";

export const reviewQueueSchema = z.enum([
  "PENDING_REVIEW",
  "PUBLISHED",
  "ACTION_NEEDED",
  "SUSPENDED",
]);
export const reviewDecisionSchema = z.object({
  action: z.enum([
    "APPROVE",
    "REQUEST_CHANGES",
    "REJECT",
    "SUSPEND",
    "RESTORE",
  ]),
  note: z.string().trim().min(5).max(1000).optional(),
});

export class ReviewActionError extends Error {
  constructor(readonly status: 404 | 409 | 422, message: string) {
    super(message);
    this.name = "ReviewActionError";
  }
}

export async function listReviewEvents(input: unknown) {
  const queue = reviewQueueSchema.parse(input);
  const status: Prisma.EventWhereInput["status"] =
    queue === "ACTION_NEEDED"
      ? { in: ["NEEDS_CHANGES", "REJECTED"] }
      : queue;
  const events = await db.event.findMany({
    where: {
      status,
      deletedAt: null,
      ...(queue === "PUBLISHED"
        ? { visibility: "PUBLIC", isTest: false, org: { status: "ACTIVE" } }
        : {}),
    },
    orderBy: [{ reviewSubmittedAt: "desc" }, { updatedAt: "desc" }],
    include: {
      org: {
        select: { name: true, slug: true, supportEmail: true, supportPhone: true },
      },
      ticketTypes: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, description: true, pricePaise: true, quantityTotal: true },
      },
      images: {
        where: { kind: { in: ["POSTER", "COVER"] } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, kind: true, alt: true, variants: true, width: true, height: true },
      },
    },
  });
  return events.map(({ images, ...event }) => ({
    ...event,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    reviewSubmittedAt: event.reviewSubmittedAt?.toISOString() ?? null,
    reviewedAt: event.reviewedAt?.toISOString() ?? null,
    images: images.map((image) => ({
      id: image.id,
      kind: image.kind,
      alt: image.alt,
      cardUrl: cardUrl(image.variants),
      width: image.width,
      height: image.height,
    })),
  }));
}

export async function decideEventReview(
  adminId: string,
  eventId: string,
  input: unknown,
) {
  z.uuid().parse(eventId);
  const { action, note } = reviewDecisionSchema.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const event = await tx.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: { ticketTypes: true, images: { where: { kind: "POSTER" } } },
    });
    if (!event) throw new ReviewActionError(404, "Event not found.");

    let status: "PUBLISHED" | "NEEDS_CHANGES" | "REJECTED" | "SUSPENDED";
    if (action === "APPROVE" && event.status === "PENDING_REVIEW") {
      try {
        assertEventCanBePublished(event);
      } catch (error) {
        throw new ReviewActionError(
          422,
          error instanceof Error ? error.message : "Event needs more details.",
        );
      }
      status = "PUBLISHED";
    } else if (action === "REQUEST_CHANGES" && event.status === "PENDING_REVIEW") {
      status = "NEEDS_CHANGES";
    } else if (action === "REJECT" && event.status === "PENDING_REVIEW") {
      status = "REJECTED";
    } else if (action === "SUSPEND" && event.status === "PUBLISHED") {
      status = "SUSPENDED";
    } else if (action === "RESTORE" && event.status === "SUSPENDED") {
      status = "PUBLISHED";
    } else {
      throw new ReviewActionError(409, "This review action is not available for the current event status.");
    }

    if (["REQUEST_CHANGES", "REJECT", "SUSPEND"].includes(action) && !note)
      throw new ReviewActionError(422, "Add a clear reason before saving this decision.");

    const updated = await tx.event.update({
      where: { id: eventId },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedById: adminId,
        reviewNote: note ?? null,
        ...(status === "PUBLISHED" && !event.publishedAt
          ? { publishedAt: new Date() }
          : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        orgId: event.orgId,
        actorId: adminId,
        action: `event.review.${action.toLowerCase()}`,
        entityType: "Event",
        entityId: eventId,
        meta: { fromStatus: event.status, toStatus: status, note: note ?? null },
      },
    });
    return updated;
  });
}

function cardUrl(variants: unknown) {
  if (!variants || typeof variants !== "object" || Array.isArray(variants)) return null;
  const card = (variants as { card?: { jpeg?: unknown } }).card;
  return typeof card?.jpeg === "string" ? card.jpeg : null;
}
