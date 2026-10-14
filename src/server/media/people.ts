import { z } from "zod";
import { db } from "@/server/db/client";
import { requireEventAccessForUser } from "@/server/rbac/access";

const personSchema = z.object({
  name: z.string().trim().min(1).max(100),
  title: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(2000).optional(),
  photoImageId: z.uuid().nullable().optional(),
  links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        url: z
          .url()
          .refine(
            (value) => /^https?:\/\//i.test(value),
            "Use an https or http link.",
          ),
      }),
    )
    .max(5)
    .optional(),
});

async function photoKey(eventId: string, imageId?: string | null) {
  if (!imageId) return null;
  const image = await db.eventImage.findFirst({
    where: { id: imageId, eventId },
  });
  if (!image) throw new Error("Person photo not found.");
  return image.storageKey;
}

export async function createPerson(
  userId: string,
  eventId: string,
  input: unknown,
) {
  await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const data = personSchema.parse(input);
  const photo = await photoKey(eventId, data.photoImageId);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const last = await tx.eventPerson.aggregate({
      where: { eventId },
      _max: { sortOrder: true },
    });
    return tx.eventPerson.create({
      data: {
        eventId,
        name: data.name,
        title: data.title,
        bio: data.bio,
        links: data.links,
        photoKey: photo,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    });
  });
}

export async function updatePerson(
  userId: string,
  eventId: string,
  personId: string,
  input: unknown,
) {
  await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const data = personSchema.partial().parse(input);
  const person = await db.eventPerson.findFirst({
    where: { id: personId, eventId },
  });
  if (!person) throw new Error("Person not found.");
  return db.eventPerson.update({
    where: { id: personId },
    data: {
      name: data.name,
      title: data.title,
      bio: data.bio,
      links: data.links,
      photoKey:
        data.photoImageId !== undefined
          ? await photoKey(eventId, data.photoImageId)
          : undefined,
    },
  });
}
export async function reorderPeople(
  userId: string,
  eventId: string,
  input: unknown,
) {
  await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const ids = z.array(z.uuid()).max(100).parse(input);
  if (new Set(ids).size !== ids.length)
    throw new Error("Lineup order contains duplicates.");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const people = await tx.eventPerson.findMany({
      where: { eventId },
      select: { id: true },
    });
    if (
      people.length !== ids.length ||
      people.some((person) => !ids.includes(person.id))
    )
      throw new Error("Lineup changed. Refresh and try again.");
    for (const [sortOrder, id] of ids.entries())
      await tx.eventPerson.update({ where: { id }, data: { sortOrder } });
  });
}

export async function deletePerson(
  userId: string,
  eventId: string,
  personId: string,
) {
  await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  const person = await db.eventPerson.findFirst({
    where: { id: personId, eventId },
  });
  if (!person) throw new Error("Person not found.");
  await db.eventPerson.delete({ where: { id: personId } });
}
