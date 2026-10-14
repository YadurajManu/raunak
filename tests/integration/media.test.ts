import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { storage } from "@/server/providers/storage/s3";
import { processMedia } from "../../worker/jobs/process-media";
import { presignImage, confirmImage } from "@/server/media/service";
import { createPerson, updatePerson, deletePerson } from "@/server/media/people";
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
    const image = await confirmImage(userId, { token, alt: "Poster" });
    keys.push(image.storageKey);
    await processMedia(image.id);
    await (await mediaQueue.getJob(image.id))?.remove();
    const base = image.storageKey.replace("/original/", "/variants/");
    for (const size of ["thumb", "card", "hero", "og"]) for (const ext of ["avif", "webp", "jpg"]) keys.push(`${base}/${size}.${ext}`);
    await expect(confirmImage(userId, { token: `${token}x`, alt: "Poster" })).rejects.toThrow("Invalid upload token");
  }, 30_000);

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
