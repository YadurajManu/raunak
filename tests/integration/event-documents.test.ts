import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { duplicateEvent } from "@/server/events/service";
import { storage } from "@/server/providers/storage/s3";
import {
  addDocument,
  documentsSchema,
  removeDocument,
} from "@/server/events/documents";
import { GET } from "@/app/api/events/[eventId]/documents/[documentId]/route";
vi.mock("@/server/auth/session", () => ({ currentUser: async () => null }));
const key = randomUUID();
let userId: string;
let outsider: string;
let eventId: string;
let orgId: string;
beforeAll(async () => {
  userId = (
    await db.user.create({
      data: { firebaseUid: `docs-${key}`, email: `docs-${key}@example.test` },
    })
  ).id;
  outsider = (
    await db.user.create({
      data: {
        firebaseUid: `outside-${key}`,
        email: `outside-${key}@example.test`,
      },
    })
  ).id;
  orgId = (
    await db.organization.create({
      data: {
        name: "Document test",
        slug: `docs-${key}`,
        members: { create: { userId, role: "OWNER" } },
      },
    })
  ).id;
  eventId = (
    await db.event.create({
      data: {
        orgId,
        slug: `docs-${key}`,
        title: "Document event",
        startsAt: new Date("2027-01-01"),
        endsAt: new Date("2027-01-02"),
      },
    })
  ).id;
});
afterAll(async () => {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (event)
    for (const document of documentsSchema.parse(event.documents))
      await storage.delete(document.key);
  await db.event.deleteMany({ where: { id: eventId } });
  await db.auditLog.deleteMany({ where: { orgId } });
  await db.organizationMember.deleteMany({ where: { orgId } });
  await db.organization.deleteMany({ where: { id: orgId } });
  await db.user.deleteMany({ where: { id: { in: [userId, outsider] } } });
});
it("rejects disguised files and unauthorized uploads; keeps drafts private and allows published PDF downloads", async () => {
  const file = new File(["%PDF-1.7\nTest brochure\n%%EOF"], "Programme.pdf", {
    type: "application/pdf",
  });
  await expect(addDocument(outsider, eventId, file)).rejects.toThrow(
    "Access denied",
  );
  await expect(
    addDocument(userId, eventId, new File(["not a PDF"], "fake.pdf")),
  ).rejects.toThrow("complete PDF");
  const document = await addDocument(userId, eventId, file);
  const context = {
    params: Promise.resolve({ eventId, documentId: document.id }),
  };
  expect((await GET(new Request("http://localhost"), context)).status).toBe(
    404,
  );
  await db.event.update({
    where: { id: eventId },
    data: { status: "PUBLISHED" },
  });
  const response = await GET(new Request("http://localhost"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toContain("attachment");
  expect(await response.text()).toContain("%PDF-");
  await removeDocument(userId, eventId, document.id);
  expect((await GET(new Request("http://localhost"), context)).status).toBe(
    404,
  );
});
