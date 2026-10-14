import { z } from "zod";
import { db } from "@/server/db/client";
import { requireEventAccessForUser } from "@/server/rbac/access";

const ticketTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).optional(),
    pricePaise: z.number().int().nonnegative().max(100_000_000),
    quantityTotal: z.number().int().positive().max(100_000),
    saleStartsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    saleEndsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    minPerOrder: z.number().int().positive().max(100).default(1),
    maxPerOrder: z.number().int().positive().max(100).default(10),
    isHidden: z.boolean().default(false),
  })
  .refine((data) => data.maxPerOrder >= data.minPerOrder, {
    message: "Maximum per order must be at least the minimum.",
    path: ["maxPerOrder"],
  })
  .refine(
    (data) =>
      !data.saleStartsAt ||
      !data.saleEndsAt ||
      new Date(data.saleEndsAt) > new Date(data.saleStartsAt),
    { message: "Sale end must be after sale start.", path: ["saleEndsAt"] },
  );

export async function createTicketType(
  userId: string,
  eventId: string,
  input: unknown,
) {
  await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const data = ticketTypeSchema.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
    const inventory = await tx.ticketType.aggregate({
      where: { eventId },
      _sum: { quantityTotal: true },
    });
    if (
      event.capacity &&
      (inventory._sum.quantityTotal ?? 0) + data.quantityTotal > event.capacity
    )
      throw new Error("Ticket inventory exceeds event capacity.");
    return tx.ticketType.create({
      data: {
        eventId,
        name: data.name,
        description: data.description,
        pricePaise: data.pricePaise,
        quantityTotal: data.quantityTotal,
        saleStartsAt: data.saleStartsAt ? new Date(data.saleStartsAt) : null,
        saleEndsAt: data.saleEndsAt ? new Date(data.saleEndsAt) : null,
        minPerOrder: data.minPerOrder,
        maxPerOrder: data.maxPerOrder,
        isHidden: data.isHidden,
      },
    });
  });
}

export async function updateTicketType(
  userId: string,
  eventId: string,
  typeId: string,
  input: unknown,
) {
  await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const data = ticketTypeSchema.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "TicketType" WHERE id = ${typeId}::uuid AND "eventId" = ${eventId}::uuid FOR UPDATE`;
    const type = await tx.ticketType.findFirst({
      where: { id: typeId, eventId },
    });
    if (!type) throw new Error("Ticket type not found.");
    if (type.quantitySold + type.quantityHeld > data.quantityTotal)
      throw new Error("New quantity is below sold and held tickets.");
    const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
    const inventory = await tx.ticketType.aggregate({
      where: { eventId },
      _sum: { quantityTotal: true },
    });
    if (
      event.capacity &&
      (inventory._sum.quantityTotal ?? 0) -
        type.quantityTotal +
        data.quantityTotal >
        event.capacity
    )
      throw new Error("Ticket inventory exceeds event capacity.");
    return tx.ticketType.update({
      where: { id: typeId },
      data: {
        name: data.name,
        description: data.description,
        pricePaise: data.pricePaise,
        quantityTotal: data.quantityTotal,
        saleStartsAt: data.saleStartsAt ? new Date(data.saleStartsAt) : null,
        saleEndsAt: data.saleEndsAt ? new Date(data.saleEndsAt) : null,
        minPerOrder: data.minPerOrder,
        maxPerOrder: data.maxPerOrder,
        isHidden: data.isHidden,
      },
    });
  });
}

export async function deleteTicketType(
  userId: string,
  eventId: string,
  typeId: string,
) {
  await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TicketType" WHERE id = ${typeId}::uuid AND "eventId" = ${eventId}::uuid FOR UPDATE`;
    const type = await tx.ticketType.findFirst({
      where: { id: typeId, eventId },
    });
    if (!type) throw new Error("Ticket type not found.");
    if (type.quantitySold || type.quantityHeld)
      throw new Error("Ticket types with orders cannot be deleted.");
    if (await tx.orderItem.count({ where: { ticketTypeId: typeId } }))
      throw new Error("Ticket types with orders cannot be deleted.");
    await tx.ticketType.delete({ where: { id: typeId } });
  });
}
