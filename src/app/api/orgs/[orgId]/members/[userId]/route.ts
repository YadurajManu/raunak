import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { changeMemberRole, removeMember } from "@/server/orgs/service";

type Context = { params: Promise<{ orgId: string; userId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try { requireSameOrigin(request); const actor = await requireUser(); const { orgId, userId } = await params; const { role } = z.object({ role: z.string() }).parse(await request.json()); await changeMemberRole(actor.id, orgId, userId, role); return Response.json({ ok: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not change role." }, { status: 400 }); }
}
export async function DELETE(request: Request, { params }: Context) {
  try { requireSameOrigin(request); const actor = await requireUser(); const { orgId, userId } = await params; await removeMember(actor.id, orgId, userId); return Response.json({ ok: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not remove member." }, { status: 400 }); }
}
