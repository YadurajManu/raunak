import { z } from "zod";
import { db } from "@/server/db/client";
import { requireEventAccessForUser } from "@/server/rbac/access";

const personSchema = z.object({
  name: z.string().trim().min(1).max(100),
  title: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(2000).optional(),
  photoImageId: z.uuid().nullable().optional(),
});

async function photoKey(eventId: string, imageId?: string | null) {
  if (!imageId) return null;
  const image = await db.eventImage.findFirst({
    where: { id: imageId, eventId, kind: "PERSON" },
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
  return db.eventPerson.create({
    data: {
      eventId,
      name: data.name,
      title: data.title,
      bio: data.bio,
      photoKey: await photoKey(eventId, data.photoImageId),
    },
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
      photoKey:
        data.photoImageId !== undefined
          ? await photoKey(eventId, data.photoImageId)
          : undefined,
    },
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
