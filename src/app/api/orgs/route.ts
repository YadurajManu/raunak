import { createOrganization } from "@/server/orgs/service";
import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const org = await createOrganization(user.id, await request.json());
    return Response.json({ id: org.id, slug: org.slug }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "This URL name is already taken. Try adding your city or a short suffix.", field: "slug" }, { status: 409 });
    }
    if (error instanceof ZodError) {
      const field = error.issues[0]?.path[0];
      return Response.json({ error: field === "slug" ? "Use 3–80 lowercase letters, numbers or single hyphens between words." : "Enter a workspace name between 2 and 100 characters.", field }, { status: 400 });
    }
    return Response.json({ error: "Could not create workspace. Please try again." }, { status: 400 });
  }
}
