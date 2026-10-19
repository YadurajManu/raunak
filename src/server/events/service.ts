import { documentsSchema } from "./documents";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db/client";
import { storage } from "@/server/providers/storage/s3";
import { Prisma } from "@/generated/prisma/client";
import {
  requireEventAccessForUser,
  requireOrgRoleForUser,
} from "@/server/rbac/access";
import { assertEventCanBePublished } from "@/server/events/publication";

const inputSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    summary: z.string().trim().max(300).optional(),
    description: z.string().max(30000).optional(),
    category: z.string().trim().max(80).optional(),
    mode: z.enum(["IN_PERSON", "ONLINE", "HYBRID"]).default("IN_PERSON"),
    visibility: z.enum(["PUBLIC", "UNLISTED"]).default("PUBLIC"),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    timezone: z
      .string()
      .min(1)
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Invalid timezone.")
      .default("Asia/Kolkata"),
    venueName: z.string().trim().max(150).optional(),
    address: z.string().trim().max(500).optional(),
    mapUrl: z.url().optional(),
    city: z.string().trim().max(100).optional(),
    lat: z.number().finite().min(-90).max(90).nullable().optional(),
    lng: z.number().finite().min(-180).max(180).nullable().optional(),
    onlineUrl: z.url().optional(),
    capacity: z.number().int().positive().optional(),
    refundPolicy: z.string().max(5000).optional(),
  })
  .refine(
    (data) => (data.lat == null) === (data.lng == null),
    "Choose both venue coordinates.",
  )
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: "End time must be after start time.",
    path: ["endsAt"],
  })
  .refine((data) => data.mode === "ONLINE" || Boolean(data.venueName), {
    message: "Venue is required for in-person events.",
    path: ["venueName"],
  })
  .refine((data) => data.mode === "IN_PERSON" || Boolean(data.onlineUrl), {
    message: "Online link is required.",
    path: ["onlineUrl"],
  });

function slug(title: string) {
  const base =
    title
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "event";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function listEvents(userId: string, orgId: string) {
  const membership = await requireOrgRoleForUser(userId, orgId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "CHECKIN",
    "FINANCE",
  ]);
  return db.event.findMany({
    where: {
      orgId,
      deletedAt: null,
      ...(membership.role === "MANAGER" || membership.role === "CHECKIN"
        ? { staff: { some: { userId, role: membership.role } } }
        : {}),
    },
    orderBy: { startsAt: "desc" },
    include: {
      ticketTypes: { select: { pricePaise: true } },
      images: { where: { kind: "POSTER" }, take: 1 },
    },
  });
}

export async function createEvent(
  userId: string,
  orgId: string,
  input: unknown,
) {
  const membership = await requireOrgRoleForUser(userId, orgId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const data = inputSchema.parse(input);
  const eventSlug = slug(data.title);
  return db.event.create({
    data: {
      orgId,
      slug: eventSlug,
      title: data.title,
      summary: data.summary,
      description: data.description,
      category: data.category,
      mode: data.mode,
      visibility: data.visibility,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      timezone: data.timezone,
      venueName: data.venueName,
      address: data.address,
      mapUrl: data.mapUrl,
      city: data.city,
      lat: data.lat,
      lng: data.lng,
      onlineUrl: data.onlineUrl,
      capacity: data.capacity,
      refundPolicy: data.refundPolicy,
      ...(membership.role === "MANAGER"
        ? { staff: { create: { userId, role: "MANAGER" } } }
        : {}),
    },
  });
}

export async function updateEvent(
  userId: string,
  eventId: string,
  input: unknown,
) {
  const event = await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const data = inputSchema.parse(input);
  if (event.deletedAt) throw new Error("Event not found.");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const inventory = await tx.ticketType.aggregate({
      where: { eventId },
      _sum: { quantityTotal: true },
    });
    if (data.capacity && (inventory._sum.quantityTotal ?? 0) > data.capacity)
      throw new Error("Capacity is below ticket inventory.");
    const updated = await tx.event.update({
      where: { id: eventId },
      data: {
        title: data.title,
        summary: data.summary ?? null,
        description: data.description ?? null,
        category: data.category ?? null,
        mode: data.mode,
        visibility: data.visibility,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        timezone: data.timezone,
        venueName: data.venueName ?? null,
        address: data.address ?? null,
        mapUrl: data.mapUrl ?? null,
        city: data.city ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        onlineUrl: data.onlineUrl ?? null,
        capacity: data.capacity ?? null,
        refundPolicy: data.refundPolicy ?? null,
      },
    });
    if (updated.status === "PUBLISHED")
      await tx.webhookEvent.create({
        data: {
          provider: "internal-events",
          idempotencyKey: `updated-${updated.id}-${updated.updatedAt.toISOString()}`,
          payload: { eventId: updated.id, trigger: "EVENT_UPDATED" },
        },
      });
    return updated;
  });
}

export async function changeEventStatus(
  userId: string,
  eventId: string,
  status: unknown,
) {
  const eventAccess = await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const next = z
    .enum(["DRAFT", "CANCELLED", "ENDED"])
    .parse(status);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const event = await tx.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { ticketTypes: true, images: { where: { kind: "POSTER" } } },
    });
    if (next === "DRAFT" && event.status !== "PUBLISHED")
      throw new Error("Only published events can be unpublished.");
    else if (next === "CANCELLED" && event.status !== "PUBLISHED")
      throw new Error("Only published events can be cancelled.");
    else if (
      next === "ENDED" &&
      (event.status !== "PUBLISHED" || event.endsAt > new Date())
    )
      throw new Error("This event has not ended.");
    const updated = await tx.event.update({
      where: { id: eventId },
      data: {
        status: next,
      },
    });
    await tx.auditLog.create({
      data: {
        orgId: eventAccess.orgId,
        actorId: userId,
        action: `event.${next.toLowerCase()}`,
        entityType: "Event",
        entityId: eventId,
      },
    });
    if (next === "CANCELLED")
      await tx.webhookEvent.create({
        data: {
          provider: "internal-events",
          idempotencyKey: `cancelled-${updated.id}-${updated.updatedAt.toISOString()}`,
          payload: { eventId: updated.id, trigger: "EVENT_CANCELLED" },
        },
      });
    return updated;
  });
}

export async function submitEventForReview(userId: string, eventId: string) {
  const access = await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const event = await tx.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { ticketTypes: true, images: { where: { kind: "POSTER" } } },
    });
    if (event.deletedAt) throw new Error("Event not found.");
    if (!["DRAFT", "NEEDS_CHANGES", "REJECTED"].includes(event.status))
      throw new Error("Only a draft or returned event can be submitted.");
    assertEventCanBePublished(event);
    const submittedAt = new Date();
    const updated = await tx.event.update({
      where: { id: eventId },
      data: {
        status: "PENDING_REVIEW",
        reviewSubmittedAt: submittedAt,
        reviewedAt: null,
        reviewedById: null,
        reviewNote: null,
      },
    });
    await tx.auditLog.create({
      data: {
        orgId: access.orgId,
        actorId: userId,
        action: "event.review.submitted",
        entityType: "Event",
        entityId: eventId,
      },
    });
    return updated;
  });
}

export async function duplicateEvent(userId: string, eventId: string) {
  const access = await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const source = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { ticketTypes: true, people: true, images: true },
  });
  const membership = await db.organizationMember.findUniqueOrThrow({
    where: { orgId_userId: { orgId: access.orgId, userId } },
  });
  const duplicate = await db.event.create({
    data: {
      orgId: source.orgId,
      slug: slug(source.title),
      title: `${source.title} (copy)`,
      summary: source.summary,
      description: source.description,
      category: source.category,
      mode: source.mode,
      visibility: source.visibility,
      isTest: source.isTest,
      startsAt: source.startsAt,
      endsAt: source.endsAt,
      timezone: source.timezone,
      venueName: source.venueName,
      address: source.address,
      mapUrl: source.mapUrl,
      city: source.city,
      lat: source.lat,
      lng: source.lng,
      onlineUrl: source.onlineUrl,
      capacity: source.capacity,
      refundPolicy: source.refundPolicy,
      ticketTypes: {
        create: source.ticketTypes.map((type) => ({
          name: type.name,
          description: type.description,
          pricePaise: type.pricePaise,
          quantityTotal: type.quantityTotal,
          saleStartsAt: type.saleStartsAt,
          saleEndsAt: type.saleEndsAt,
          minPerOrder: type.minPerOrder,
          maxPerOrder: type.maxPerOrder,
          isHidden: type.isHidden,
          sortOrder: type.sortOrder,
        })),
      },
      ...(membership.role === "MANAGER"
        ? { staff: { create: { userId, role: "MANAGER" } } }
        : {}),
    },
  });
  const copiedKeys: string[] = [];
  const photoKeys = new Map<string, string>();
  const pending: string[] = [];
  try {
    const documents = [];
    for (const document of documentsSchema.parse(source.documents)) {
      const id = randomUUID();
      const key = `documents/${duplicate.id}/${id}.pdf`;
      await storage.copy(document.key, key);
      copiedKeys.push(key);
      documents.push({ ...document, id, key });
    }
    if (documents.length)
      await db.event.update({
        where: { id: duplicate.id },
        data: { documents },
      });
    for (const image of source.images) {
      const isSeedImage = image.storageKey.startsWith("/seed/");
      const newKey = isSeedImage
        ? `${image.storageKey}#${duplicate.id}`
        : `orgs/${source.orgId}/events/${duplicate.id}/original/${randomUUID()}`;
      if (!isSeedImage) {
        await storage.copy(image.storageKey, newKey);
        copiedKeys.push(newKey);
      }
      const clone = await db.eventImage.create({
        data: {
          eventId: duplicate.id,
          kind: image.kind,
          storageKey: newKey,
          variants: isSeedImage
            ? (image.variants ?? Prisma.DbNull)
            : Prisma.DbNull,
          crop: image.crop ?? Prisma.DbNull,
          width: isSeedImage ? image.width : null,
          height: isSeedImage ? image.height : null,
          blurhash: isSeedImage ? image.blurhash : null,
          alt: image.alt,
          mime: image.mime,
          sizeBytes: image.sizeBytes,
          sortOrder: image.sortOrder,
        },
      });
      photoKeys.set(image.storageKey, newKey);
      if (!isSeedImage) pending.push(clone.id);
    }
    for (const person of source.people)
      await db.eventPerson.create({
        data: {
          eventId: duplicate.id,
          name: person.name,
          title: person.title,
          bio: person.bio,
          photoKey: person.photoKey
            ? (photoKeys.get(person.photoKey) ?? null)
            : null,
          links: person.links ?? Prisma.DbNull,
          sortOrder: person.sortOrder,
        },
      });
  } catch (error) {
    await db.event.delete({ where: { id: duplicate.id } });
    for (const key of copiedKeys) await storage.delete(key);
    throw error;
  }
  if (pending.length) {
    const { mediaQueue } = await import("../../../worker/queues");
    for (const imageId of pending)
      await mediaQueue.add(
        "process",
        { imageId },
        {
          jobId: imageId,
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: true,
        },
      );
  }
  await db.auditLog.create({
    data: {
      orgId: access.orgId,
      actorId: userId,
      action: "event.duplicated",
      entityType: "Event",
      entityId: duplicate.id,
      meta: { sourceEventId: eventId },
    },
  });
  return duplicate;
}

export async function softDeleteEvent(userId: string, eventId: string) {
  const event = await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
  ]);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const current = await tx.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    if (current.status !== "DRAFT")
      throw new Error("Only draft events can be deleted.");
    if (await tx.order.count({ where: { eventId } }))
      throw new Error("Events with orders cannot be deleted.");
    await tx.event.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        orgId: event.orgId,
        actorId: userId,
        action: "event.deleted",
        entityType: "Event",
        entityId: eventId,
      },
    });
  });
}
