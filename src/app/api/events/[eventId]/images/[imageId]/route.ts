import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { updateImage, deleteImage } from "@/server/media/service";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { mediaQueue } from "../../../../../../../worker/queues";
import { presignMediaRead } from "@/server/providers/storage/s3";

type Context = { params: Promise<{ eventId: string; imageId: string }> };
export async function GET(request: Request, {params}:Context) {
  try {
    const user = await requireUser();
    const {eventId,imageId} = await params;
    await requireEventAccessForUser(user.id,eventId,["OWNER","ADMIN","MANAGER"]);
    const image = await db.eventImage.findFirstOrThrow({where:{id:imageId,eventId}});
    const revision = (image.crop as {revision?:string} | null)?.revision;
    const job = await mediaQueue.getJob(revision ? `${imageId}-${revision}` : imageId);
    return Response.json({image,progress:typeof job?.progress === "number" ? job.progress : 0,...(new URL(request.url).searchParams.has("original") ? {originalUrl:await presignMediaRead(image.storageKey)} : {})},{headers:{"Cache-Control":"private, no-store"}});
  } catch { return Response.json({error:"Image status is unavailable."},{status:400}); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId, imageId } = await params;
    return Response.json(
      await updateImage(user.id, eventId, imageId, await request.json()),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update image.",
      },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId, imageId } = await params;
    await deleteImage(user.id, eventId, imageId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not delete image.",
      },
      { status: 400 },
    );
  }
}
