import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { storage } from "@/server/providers/storage/s3";
import { Prisma } from "@/generated/prisma/client";
import { cropSchema } from "@/lib/image-crop";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_EVENT_IMAGES = 20;
const mime = z.enum(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/heic", "image/heif"]);
const kind = z.enum(["POSTER", "COVER", "GALLERY", "PERSON"]);
const presignInput = z.object({ eventId: z.uuid(), kind, mime, sizeBytes: z.number().int().positive().max(MAX_IMAGE_BYTES) });
const tokenPayload = z.object({ eventId: z.uuid(), userId: z.uuid(), kind, mime, sizeBytes: z.number().int().positive().max(MAX_IMAGE_BYTES), key: z.string().min(1), expiresAt: z.number().int() });

function secret() {
  const value = process.env.TICKET_SIGNING_SECRET;
  if (!value || value.length < 32) throw new Error("TICKET_SIGNING_SECRET must be at least 32 characters.");
  return value;
}

function sign(payload: string) { return createHmac("sha256", secret()).update(`media.v1.${payload}`).digest("base64url"); }

function verify(token: string) {
  const [version, payload, signature] = token.split(".");
  if (version !== "v1" || !payload || !signature) throw new Error("Invalid upload token.");
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("Invalid upload token.");
  const parsed = tokenPayload.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  if (parsed.expiresAt < Date.now()) throw new Error("Upload token has expired.");
  return parsed;
}

export async function presignImage(userId: string, input: unknown) {
  const data = presignInput.parse(input);
  const event = await requireEventAccessForUser(userId, data.eventId, ["OWNER", "ADMIN", "MANAGER"]);
  const count = await db.eventImage.count({ where: { eventId: event.id } });
  if (count >= MAX_EVENT_IMAGES) throw new Error("This event has reached its image limit.");
  const key = `orgs/${event.orgId}/events/${event.id}/original/${randomUUID()}`;
  const payload = Buffer.from(JSON.stringify({ ...data, userId, key, expiresAt: Date.now() + 5 * 60 * 1000 })).toString("base64url");
  return { url: await storage.presignPut(key, data.mime), token: `v1.${payload}.${sign(payload)}` };
}

export async function confirmImage(userId: string, input: unknown) {
  const { token, alt } = z.object({ token: z.string().min(1).max(2000), alt: z.string().trim().min(1).max(300) }).parse(input);
  const data = verify(token);
  if (data.userId !== userId) throw new Error("Invalid upload token.");
  const event = await requireEventAccessForUser(userId, data.eventId, ["OWNER", "ADMIN", "MANAGER"]);
  if (!data.key.startsWith(`orgs/${event.orgId}/events/${event.id}/original/`)) throw new Error("Invalid upload key.");
  const object = await storage.head(data.key);
  if (object.size !== data.sizeBytes || object.size > MAX_IMAGE_BYTES || object.mime !== data.mime) throw new Error("Uploaded file does not match the request.");
  const existing = await db.eventImage.findUnique({ where: { storageKey: data.key } });
  if (existing) return existing;
  const image = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${event.id}::uuid FOR UPDATE`;
    if (await tx.eventImage.count({ where: { eventId: event.id } }) >= MAX_EVENT_IMAGES) throw new Error("This event has reached its image limit.");
    if (data.kind === "POSTER" || data.kind === "COVER") await tx.eventImage.updateMany({ where: { eventId: event.id, kind: data.kind }, data: { kind: "GALLERY" } });
    return tx.eventImage.create({ data: { eventId: event.id, kind: data.kind, storageKey: data.key, mime: data.mime, sizeBytes: data.sizeBytes, alt } });
  });
  const { mediaQueue } = await import("../../../worker/queues");
  await mediaQueue.add("process", { imageId: image.id }, { jobId: image.id, attempts: 5, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: true });
  return image;
}

export async function updateImage(userId: string, eventId: string, imageId: string, input: unknown) {
  await requireEventAccessForUser(userId, eventId, ["OWNER", "ADMIN", "MANAGER"]);
  const data = z.object({ alt: z.string().trim().min(1).max(300).optional(), kind: kind.optional(), crop:cropSchema.optional(), retry:z.boolean().optional() }).parse(input);
  const saved = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const image = await tx.eventImage.findFirst({ where: { id: imageId, eventId } });
    if (!image) throw new Error("Image not found.");
    if (data.kind === "POSTER" || data.kind === "COVER") await tx.eventImage.updateMany({ where: { eventId, kind: data.kind, id: { not: imageId } }, data: { kind: "GALLERY" } });
    if (image.kind === "PERSON" && data.kind && data.kind !== "PERSON") await tx.eventPerson.updateMany({ where: { eventId, photoKey: image.storageKey }, data: { photoKey: null } });
    const previous = image.crop as {revision?:string;previous?:string[]} | null;
    return tx.eventImage.update({ where: { id: imageId }, data: {alt:data.alt,kind:data.kind,...(data.crop || data.retry ? {crop:{...(data.crop || cropSchema.parse(image.crop || {aspect:"original",x:.5,y:.5})),revision:randomUUID(),previous:[...(previous?.previous || []),...(previous?.revision ? [previous.revision] : [])]},variants:Prisma.DbNull,processingError:null} : {})} });
  });
  if (data.crop || data.retry) {
    const {mediaQueue} = await import("../../../worker/queues");
    const revision = (saved.crop as {revision:string}).revision;
    await mediaQueue.add("process",{imageId},{jobId:`${imageId}-${revision}`,attempts:5,backoff:{type:"exponential",delay:1000},removeOnComplete:true});
  }
  return saved;
}

export async function reorderImages(userId: string, eventId: string, input: unknown) {
  await requireEventAccessForUser(userId, eventId, ["OWNER", "ADMIN", "MANAGER"]);
  const ids = z.array(z.uuid()).max(MAX_EVENT_IMAGES).parse(input);
  if (new Set(ids).size !== ids.length) throw new Error("Image order contains duplicates.");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const images = await tx.eventImage.findMany({ where: { eventId }, select: { id: true } });
    if (images.length !== ids.length || images.some(image => !ids.includes(image.id))) throw new Error("Image order does not match the event.");
    for (const [sortOrder, id] of ids.entries()) await tx.eventImage.update({ where: { id }, data: { sortOrder } });
  });
}

export async function deleteImage(userId: string, eventId: string, imageId: string) {
  await requireEventAccessForUser(userId, eventId, ["OWNER", "ADMIN", "MANAGER"]);
  const image = await db.eventImage.findFirst({ where: { id: imageId, eventId } });
  if (!image) throw new Error("Image not found.");
  await db.eventImage.update({ where: { id: imageId }, data: { processingError: "Deleting" } });
  // shortcut: an already-running conversion may finish after deletion; add a durable deletion outbox if this occurs in production.
  const crop = image.crop as {revision?:string;previous?:string[]} | null;
  const versions = ["",...(crop?.previous || []),...(crop?.revision ? [crop.revision] : [])];
  for (const key of [image.storageKey, ...versions.flatMap(version=>Object.keys({ thumb: 1, card: 1, hero: 1, og: 1 }).flatMap(size => ["avif", "webp", "jpg"].map(ext => `${image.storageKey.replace("/original/", "/variants/")}${version ? `/${version}` : ""}/${size}.${ext}`)))]) await storage.delete(key);
  await db.$transaction(async (tx) => {
    await tx.eventPerson.updateMany({ where: { eventId, photoKey: image.storageKey }, data: { photoKey: null } });
    await tx.eventImage.delete({ where: { id: imageId } });
  });
}
