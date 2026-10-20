import { boundedFormData } from "@/server/http/form-data";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { requireOrgRoleForUser } from "@/server/rbac/access";
import { storage } from "@/server/providers/storage/s3";
import { db } from "@/server/db/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { logoKey: true },
  });
  if (!org?.logoKey) return new Response(null, { status: 404 });

  // Extract storage key if stored as an internal key or query
  const storageKey = org.logoKey.startsWith("http")
    ? null
    : org.logoKey.replace(/^\/api\/orgs\/[^/]+\/logo(?:\?.*)?$/, `orgs/${orgId}/branding/logo.webp`);

  try {
    // If logoKey is an absolute S3 key, use it; otherwise search by prefix
    const key = org.logoKey.startsWith("orgs/")
      ? org.logoKey
      : storageKey || `orgs/${orgId}/branding/logo.webp`;
    const bytes = await storage.read(key, 5 * 1024 * 1024);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { orgId } = await params;
    await requireOrgRoleForUser(user.id, orgId, ["OWNER", "ADMIN"]);

    const formData = await boundedFormData(request, 10 * 1024 * 1024);
    const file = formData.get("file") || formData.get("photo");
    if (!(file instanceof File) || !file.size || file.size > 8 * 1024 * 1024) {
      throw new Error("Choose an image smaller than 8 MB.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    let image = sharp(bytes, { limitInputPixels: 35_000_000 }).rotate();
    const metadata = await image.metadata();

    if (!["jpeg", "png", "webp", "avif", "heic", "heif"].includes(metadata.format || "")) {
      throw new Error("Choose a JPEG, PNG, or WebP image.");
    }

    // Optional crop extraction
    const cropX = formData.get("x") ? Number(formData.get("x")) : null;
    const cropY = formData.get("y") ? Number(formData.get("y")) : null;
    const cropWidth = formData.get("width") ? Number(formData.get("width")) : null;
    const cropHeight = formData.get("height") ? Number(formData.get("height")) : null;

    if (
      cropX !== null &&
      cropY !== null &&
      cropWidth !== null &&
      cropHeight !== null &&
      cropWidth > 0 &&
      cropHeight > 0
    ) {
      image = image.extract({
        left: Math.max(0, Math.round(cropX)),
        top: Math.max(0, Math.round(cropY)),
        width: Math.min(metadata.width || cropWidth, Math.round(cropWidth)),
        height: Math.min(metadata.height || cropHeight, Math.round(cropHeight)),
      });
    }

    const key = `orgs/${orgId}/branding/logo-${randomUUID()}.webp`;
    const buffer = await image
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();

    await storage.write(key, buffer, "image/webp");

    const previousOrg = await db.organization.findUnique({
      where: { id: orgId },
      select: { logoKey: true },
    });

    const logoUrl = `/api/orgs/${orgId}/logo?v=${Date.now()}`;
    await db.organization.update({
      where: { id: orgId },
      data: { logoKey: key },
    });

    if (previousOrg?.logoKey?.startsWith(`orgs/${orgId}/branding/`)) {
      await storage.delete(previousOrg.logoKey).catch(() => undefined);
    }

    return Response.json({ ok: true, logoKey: logoUrl, storageKey: key });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not upload logo." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { orgId } = await params;
    await requireOrgRoleForUser(user.id, orgId, ["OWNER", "ADMIN"]);

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { logoKey: true },
    });

    await db.organization.update({
      where: { id: orgId },
      data: { logoKey: null },
    });

    if (org?.logoKey?.startsWith(`orgs/${orgId}/branding/`)) {
      await storage.delete(org.logoKey).catch(() => undefined);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not remove logo." },
      { status: 400 },
    );
  }
}
