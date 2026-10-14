import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { storage } from "@/server/providers/storage/s3";
export const documentsSchema = z
  .array(
    z.object({
      id: z.uuid(),
      name: z.string().max(150),
      key: z.string(),
      size: z.number().int().positive(),
    }),
  )
  .max(10);
export async function addDocument(userId: string, eventId: string, file: File) {
  await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error("Choose a PDF up to 10 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (
    !bytes.subarray(0, 5).equals(Buffer.from("%PDF-")) ||
    !bytes.subarray(-2048).includes(Buffer.from("%%EOF"))
  )
    throw new Error("This file is not a complete PDF.");
  const id = randomUUID();
  const document = {
    id,
    name:
      file.name.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 150) ||
      "Event guide.pdf",
    key: `documents/${eventId}/${id}.pdf`,
    size: bytes.length,
  };
  await storage.write(document.key, bytes, "application/pdf");
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
      });
      const documents = documentsSchema.parse(event.documents);
      if (documents.length >= 10)
        throw new Error("You can attach up to 10 PDFs.");
      await tx.event.update({
        where: { id: eventId },
        data: { documents: [...documents, document] },
      });
    });
  } catch (error) {
    await storage.delete(document.key).catch(() => undefined);
    throw error;
  }
  return document;
}
export async function removeDocument(
  userId: string,
  eventId: string,
  documentId: string,
) {
  await requireEventAccessForUser(userId, eventId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  z.uuid().parse(documentId);
  const removed = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
    const documents = documentsSchema.parse(event.documents);
    const document = documents.find((item) => item.id === documentId);
    if (!document) throw new Error("Document not found.");
    await tx.event.update({
      where: { id: eventId },
      data: { documents: documents.filter((item) => item.id !== documentId) },
    });
    return document;
  });
  await storage.delete(removed.key).catch(() => undefined);
}
