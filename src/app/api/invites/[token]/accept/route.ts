import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { acceptInvite } from "@/server/orgs/service";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { token } = await params;
    const orgId = await acceptInvite(user.id, token);
    return Response.json({ orgId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not accept invitation." }, { status: 400 });
  }
}
