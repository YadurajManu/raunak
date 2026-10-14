import { createOrganization } from "@/server/orgs/service";
import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const org = await createOrganization(user.id, await request.json());
    return Response.json({ id: org.id, slug: org.slug }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create workspace." }, { status: 400 });
  }
}
