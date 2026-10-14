import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { inviteMember } from "@/server/orgs/service";

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { orgId } = await params;
    const invite = await inviteMember(user.id, orgId, await request.json());
    return Response.json(invite, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not invite member." }, { status: 400 });
  }
}
