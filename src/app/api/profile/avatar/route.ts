import { boundedFormData } from "@/server/http/form-data";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { currentUser, requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { storage } from "@/server/providers/storage/s3";
import { db } from "@/server/db/client";

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response(null, { status: 401 });
  if (!user.avatarKey?.startsWith(`avatars/${user.id}/`))
    return new Response(null, { status: 404 });
  const bytes = await storage.read(user.avatarKey, 2 * 1024 * 1024);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    if (Number(request.headers.get("content-length") || 0) > 3 * 1024 * 1024)
      throw new Error("Choose an image smaller than 2 MB.");
    const file = (await boundedFormData(request, 3 * 1024 * 1024)).get("photo");
    if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024)
      throw new Error("Choose an image smaller than 2 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const image = sharp(bytes, { limitInputPixels: 25_000_000 });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
      throw new Error("Choose a JPEG, PNG or WebP image.");
    const key = `avatars/${user.id}/${randomUUID()}.webp`;
    await storage.write(
      key,
      await image
        .rotate()
        .resize(512, 512, { fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer(),
      "image/webp",
    );
    await db.user.update({ where: { id: user.id }, data: { avatarKey: key } });
    if (user.avatarKey?.startsWith(`avatars/${user.id}/`))
      await storage.delete(user.avatarKey).catch(() => undefined);
    return Response.json({ url: `/api/profile/avatar?v=${Date.now()}` });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Could not save photo.",
      },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request) {
  requireSameOrigin(request);
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { avatarKey: null } });
  if (user.avatarKey?.startsWith(`avatars/${user.id}/`))
    await storage.delete(user.avatarKey).catch(() => undefined);
  return Response.json({ ok: true });
}
