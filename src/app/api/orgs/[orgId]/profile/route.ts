import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { requireOrgRoleForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { z } from "zod";

const socialLinksSchema = z
  .object({
    instagram: z.string().url().or(z.literal("")).optional(),
    twitter: z.string().url().or(z.literal("")).optional(),
    youtube: z.string().url().or(z.literal("")).optional(),
    website: z.string().url().or(z.literal("")).optional(),
    linkedin: z.string().url().or(z.literal("")).optional(),
  })
  .optional();

const profileSchema = z.object({
  tagline: z.string().max(160).optional(),
  bio: z.string().max(2000).optional(),
  socialLinks: socialLinksSchema,
  supportEmail: z.string().email().or(z.literal("")).optional(),
  supportPhone: z.string().max(20).or(z.literal("")).optional(),
  profileVisible: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { orgId } = await params;
    await requireOrgRoleForUser(user.id, orgId, ["OWNER", "ADMIN"]);
    const body = profileSchema.parse(await request.json());

    // Clean empty strings to null for optional fields
    const data: Record<string, unknown> = {};
    if (body.tagline !== undefined)
      data.tagline = body.tagline.trim() || null;
    if (body.bio !== undefined)
      data.bio = body.bio.trim() || null;
    if (body.socialLinks !== undefined) {
      const cleaned: Record<string, string> = {};
      for (const [key, value] of Object.entries(body.socialLinks)) {
        if (value && value.trim()) cleaned[key] = value.trim();
      }
      data.socialLinks = cleaned;
    }
    if (body.supportEmail !== undefined)
      data.supportEmail = body.supportEmail.trim() || null;
    if (body.supportPhone !== undefined)
      data.supportPhone = body.supportPhone.trim() || null;
    if (body.profileVisible !== undefined)
      data.profileVisible = body.profileVisible;

    const org = await db.organization.update({
      where: { id: orgId },
      data,
      select: { id: true, slug: true },
    });

    await db.auditLog.create({
      data: {
        orgId,
        actorId: user.id,
        action: "organization.profile_updated",
        entityType: "Organization",
        entityId: orgId,
        meta: { fields: Object.keys(data) },
      },
    });

    return Response.json({ id: org.id, slug: org.slug });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid input." },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "Could not update profile." },
      { status: 400 },
    );
  }
}
