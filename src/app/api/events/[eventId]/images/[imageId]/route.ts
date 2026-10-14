import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { updateImage, deleteImage } from "@/server/media/service";

type Context = { params: Promise<{ eventId: string; imageId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try { requireSameOrigin(request); const user = await requireUser(); const { eventId, imageId } = await params; return Response.json(await updateImage(user.id, eventId, imageId, await request.json())); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not update image." }, { status: 400 }); }
}
export async function DELETE(request: Request, { params }: Context) {
  try { requireSameOrigin(request); const user = await requireUser(); const { eventId, imageId } = await params; await deleteImage(user.id, eventId, imageId); return Response.json({ ok: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not delete image." }, { status: 400 }); }
}
