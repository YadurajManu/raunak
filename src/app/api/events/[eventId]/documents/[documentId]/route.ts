import { z } from "zod";
import { requireSameOrigin } from "@/server/auth/origin";
import { currentUser, requireUser } from "@/server/auth/session";
import { documentsSchema, removeDocument } from "@/server/events/documents";
import { db } from "@/server/db/client";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { storage } from "@/server/providers/storage/s3";
type Context = { params: Promise<{ eventId: string; documentId: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const { eventId, documentId } = await params;
    z.uuid().parse(eventId);
    z.uuid().parse(documentId);
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event || event.deletedAt) throw new Error("Not found.");
    if (event.status !== "PUBLISHED") {
      const user = await currentUser();
      if (!user) throw new Error("Not found.");
      await requireEventAccessForUser(user.id, eventId, [
        "OWNER",
        "ADMIN",
        "MANAGER",
      ]);
    }
    const document = documentsSchema
      .parse(event.documents)
      .find((item) => item.id === documentId);
    if (!document) throw new Error("Not found.");
    const bytes = await storage.read(document.key, 10 * 1024 * 1024);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="event-guide.pdf"; filename*=UTF-8''${encodeURIComponent(document.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId, documentId } = await params;
    await removeDocument(user.id, eventId, documentId);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not remove PDF." }, { status: 403 });
  }
}
