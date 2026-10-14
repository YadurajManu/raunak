import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { storage } from "@/server/providers/storage/s3";
import { processMedia } from "../../worker/jobs/process-media";
import { presignImage, confirmImage, updateImage, deleteImage } from "@/server/media/service";
import { createPerson, updatePerson, deletePerson, reorderPeople } from "@/server/media/people";
import { mediaQueue, mediaConnection } from "../../worker/queues";

const key = randomUUID().slice(0, 8);
let userId: string;
let orgId: string;
let eventId: string;
const keys: string[] = [];

beforeAll(async () => {
  const user = await db.user.create({ data: { firebaseUid: `media-${key}`, email: `media-${key}@example.test` } });
  userId = user.id;
  const org = await db.organization.create({ data: { name: "Media Test", slug: `media-${key}`, members: { create: { userId, role: "OWNER" } } } });
  orgId = org.id;
  const event = await db.event.create({ data: { orgId, slug: `media-${key}`, title: "Media test", startsAt: new Date("2027-01-01T00:00:00Z"), endsAt: new Date("2027-01-01T01:00:00Z") } });
  eventId = event.id;
});

afterAll(async () => {
  for (const key of keys) await storage.delete(key);
  if (eventId) await db.event.delete({ where: { id: eventId } });
  if (orgId) await db.organization.delete({ where: { id: orgId } });
  if (userId) await db.user.delete({ where: { id: userId } });
  await mediaQueue.close();
  await mediaConnection.quit();
});

async function upload(input: Buffer, mime: string) {
  const objectKey = `orgs/${orgId}/events/${eventId}/original/${randomUUID()}`;
  keys.push(objectKey);
  await storage.write(objectKey, input, mime);
  return db.eventImage.create({ data: { eventId, kind: "GALLERY", storageKey: objectKey, mime, sizeBytes: input.length, alt: "Test image" } });
}

describe("media processor", () => {
  it("saves reversible crops and reports measured processing progress", async () => {
    const bytes=await sharp({create:{width:1600,height:900,channels:3,background:"#ff5635"}}).png().toBuffer();
    const image=await upload(bytes,"image/png");
    const edited=await updateImage(userId,eventId,image.id,{crop:{aspect:"square",x:1,y:.5}});
    const values:number[]=[];
    await processMedia(image.id,async value=>{values.push(value);});
    const saved=await db.eventImage.findUniqueOrThrow({where:{id:image.id}});
    const url=(saved.variants as Record<string,Record<string,string>>).card.jpeg;
    const metadata=await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).metadata();
    expect(metadata.width).toBe(metadata.height);
    expect(values).toHaveLength(12);expect(values.at(-1)).toBe(100);
    expect(await storage.read(image.storageKey,10*1024*1024)).toEqual(bytes);
    const revision=(edited.crop as {revision:string}).revision;
    await (await mediaQueue.getJob(`${image.id}-${revision}`))?.remove();
    await deleteImage(userId,eventId,image.id);
  },30000);
  it("builds variants for JPG, PNG, WebP, AVIF, GIF, and HEIC", async () => {
    const source = await readFile("tests/fixtures/source.png");
    const formats = [
      ["image/jpeg", await sharp(source).jpeg().toBuffer()],
      ["image/png", source],
      ["image/webp", await sharp(source).webp().toBuffer()],
      ["image/avif", await sharp(source).avif().toBuffer()],
      ["image/gif", await sharp(source).gif().toBuffer()],
      ["image/heic", await readFile("tests/fixtures/source.heic")],
    ] as const;
    for (const [mime, bytes] of formats) {
      const image = await upload(bytes, mime);
      await processMedia(image.id);
      const saved = await db.eventImage.findUniqueOrThrow({ where: { id: image.id } });
      const variants = saved.variants as Record<string, Record<string, string>>;
      expect(variants.og.jpeg).toContain("/variants/");
      expect((await fetch(variants.og.jpeg)).status).toBe(200);
      expect(variants.thumb.avif).toContain("/variants/");
      expect(saved.blurhash).toBeTruthy();
      expect(saved.processingError).toBeNull();
      const base = image.storageKey.replace("/original/", "/variants/");
      for (const size of ["thumb", "card", "hero", "og"]) for (const ext of ["avif", "webp", "jpg"]) keys.push(`${base}/${size}.${ext}`);
    }
  }, 120_000);

  it("presigns and confirms a direct upload", async () => {
    process.env.TICKET_SIGNING_SECRET = "test-signing-secret-with-32-characters-minimum";
    const bytes = await readFile("tests/fixtures/source.png");
    const { url, token } = await presignImage(userId, { eventId, kind: "POSTER", mime: "image/png", sizeBytes: bytes.length });
    const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: bytes });
    expect(response.ok).toBe(true);
    const [image,replay] = await Promise.all([confirmImage(userId, { token, alt: "Poster" }),confirmImage(userId, { token, alt: "Poster" })]);
    expect(replay.id).toBe(image.id);
    expect(await db.eventImage.count({where:{storageKey:image.storageKey}})).toBe(1);
    keys.push(image.storageKey);
    await processMedia(image.id);
    await (await mediaQueue.getJob(image.id))?.remove();
    const base = image.storageKey.replace("/original/", "/variants/");
    for (const size of ["thumb", "card", "hero", "og"]) for (const ext of ["avif", "webp", "jpg"]) keys.push(`${base}/${size}.${ext}`);
    await expect(confirmImage(userId, { token: `${token}x`, alt: "Poster" })).rejects.toThrow("Invalid upload token");
  }, 30_000);

  it("replaces artwork without deleting originals or losing person links",async()=>{
    const bytes=await readFile("tests/fixtures/source.png");
    const original=await upload(bytes,"image/png");const replacement=await upload(bytes,"image/png");
    const person=await createPerson(userId,eventId,{name:"Photo guest",photoImageId:original.id});
    await updateImage(userId,eventId,original.id,{kind:"COVER"});
    expect((await db.eventPerson.findUniqueOrThrow({where:{id:person.id}})).photoKey).toBe(original.storageKey);
    await processMedia(replacement.id);
    await updateImage(userId,eventId,original.id,{replacementId:replacement.id,replacementRole:"COVER"});
    const replay=await updateImage(userId,eventId,original.id,{replacementId:replacement.id,replacementRole:"COVER"});
    expect(replay.kind).toBe("COVER");
    expect((await db.eventPerson.findUniqueOrThrow({where:{id:person.id}})).photoKey).toBe(replacement.storageKey);
    expect((await db.eventImage.findUniqueOrThrow({where:{id:original.id}})).kind).toBe("GALLERY");
    expect((await storage.head(original.storageKey)).size).toBe(bytes.length);
    await deletePerson(userId,eventId,person.id);await deleteImage(userId,eventId,original.id);await deleteImage(userId,eventId,replacement.id);
  });
  it("persists lineup order, rejects invalid lists and appends new people",async()=>{
    const a=await createPerson(userId,eventId,{name:"First",title:"DJ",links:[{label:"Website",url:"https://example.com"}]});
    const b=await createPerson(userId,eventId,{name:"Second"});
    await reorderPeople(userId,eventId,[b.id,a.id]);
    expect((await db.eventPerson.findMany({where:{eventId},orderBy:{sortOrder:"asc"}})).map(person=>person.id)).toEqual([b.id,a.id]);
    await expect(reorderPeople(userId,eventId,[a.id,a.id])).rejects.toThrow(/duplicates/);
    const c=await createPerson(userId,eventId,{name:"Third"});
    expect(c.sortOrder).toBeGreaterThan(a.sortOrder);
    await expect(reorderPeople(randomUUID(),eventId,[b.id,a.id,c.id])).rejects.toThrow();
    for(const person of [a,b,c])await deletePerson(userId,eventId,person.id);
  });
  it("copies originals for event duplication", async () => {
    const bytes = await readFile("tests/fixtures/source.png");
    const source = await upload(bytes, "image/png");
    const copyKey = `orgs/${orgId}/events/${eventId}/original/${randomUUID()}`;
    keys.push(copyKey);
    await storage.copy(source.storageKey, copyKey);
    expect((await storage.head(copyKey)).size).toBe(bytes.length);
  });

  it("links and edits a lineup photo within its event", async () => {
    const image = await upload(await readFile("tests/fixtures/source.png"), "image/png");
    await db.eventImage.update({ where: { id: image.id }, data: { kind: "PERSON" } });
    const person = await createPerson(userId, eventId, { name: "Rohan", title: "Speaker", photoImageId: image.id });
    expect(person.photoKey).toBe(image.storageKey);
    const updated = await updatePerson(userId, eventId, person.id, { title: "Host", photoImageId: null });
    expect(updated.title).toBe("Host");
    expect(updated.photoKey).toBeNull();
    await deletePerson(userId, eventId, person.id);
  });

  it("rejects a non-image disguised as a JPEG", async () => {
    const image = await upload(Buffer.from("not an image"), "image/jpeg");
    await expect(processMedia(image.id)).rejects.toThrow("supported image");
    const saved = await db.eventImage.findUniqueOrThrow({ where: { id: image.id } });
    expect(saved.processingError).toMatch(/supported image/);
  });
});
