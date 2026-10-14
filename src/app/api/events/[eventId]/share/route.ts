import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { requireEventAccessForUser } from "@/server/rbac/access";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { eventId } = await params;
    await requireEventAccessForUser(user.id, eventId, [
      "OWNER",
      "ADMIN",
      "MANAGER",
    ]);
    const { slug } = z
      .object({
        slug: z
          .string()
          .min(3)
          .max(100)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      })
      .parse(await request.json());
    await db.event.update({ where: { id: eventId }, data: { slug } });
    return Response.json({ slug });
  } catch (error) {
    const taken =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002";
    return Response.json(
      {
        error: taken
          ? "This event URL is already taken. Choose another name."
          : error instanceof z.ZodError
            ? "Use 3–100 lowercase letters, numbers and hyphens."
            : "Could not save the event URL. Please try again.",
      },
      { status: taken ? 409 : 400 },
    );
  }
}
