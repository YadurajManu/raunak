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
    select: { coverKey: true },
  });
  if (!org?.coverKey) return new Response(null, { status: 404 });

  const storageKey = org.coverKey.startsWith("http")
    ? null
    : org.coverKey.replace(/^\/api\/orgs\/[^/]+\/cover(?:\?.*)?$/, `orgs/${orgId}/branding/cover.webp`);

  try {
    const key = org.coverKey.startsWith("orgs/")
      ? org.coverKey
      : storageKey || `orgs/${orgId}/branding/cover.webp`;
    const bytes = await storage.read(key, 10 * 1024 * 1024);
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

    const formData = await boundedFormData(request, 15 * 1024 * 1024);
    const file = formData.get("file") || formData.get("cover");
    if (!(file instanceof File) || !file.size || file.size > 12 * 1024 * 1024) {
      throw new Error("Choose an image smaller than 12 MB.");
    }

    const position = formData.get("position")?.toString() || "center";

    const bytes = Buffer.from(await file.arrayBuffer());
    const image = sharp(bytes, { limitInputPixels: 50_000_000 }).rotate();
    const metadata = await image.metadata();

    if (!["jpeg", "png", "webp", "avif", "heic", "heif"].includes(metadata.format || "")) {
      throw new Error("Choose a JPEG, PNG, or WebP banner.");
    }

    const key = `orgs/${orgId}/branding/cover-${randomUUID()}.webp`;
    const buffer = await image
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    await storage.write(key, buffer, "image/webp");

    const previousOrg = await db.organization.findUnique({
      where: { id: orgId },
      select: { coverKey: true },
    });

    const coverUrl = `/api/orgs/${orgId}/cover?v=${Date.now()}`;
    await db.organization.update({
      where: { id: orgId },
      data: { coverKey: key, coverPosition: position },
    });

    if (previousOrg?.coverKey?.startsWith(`orgs/${orgId}/branding/`)) {
      await storage.delete(previousOrg.coverKey).catch(() => undefined);
    }

    return Response.json({
      ok: true,
      coverKey: coverUrl,
      storageKey: key,
      position,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not upload cover." },
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
      select: { coverKey: true },
    });

    await db.organization.update({
      where: { id: orgId },
      data: { coverKey: null },
    });

    if (org?.coverKey?.startsWith(`orgs/${orgId}/branding/`)) {
      await storage.delete(org.coverKey).catch(() => undefined);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not remove cover." },
      { status: 400 },
    );
  }
}
