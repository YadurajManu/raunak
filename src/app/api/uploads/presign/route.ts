import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { presignImage } from "@/server/media/service";
export async function POST(request: Request) {
  try { requireSameOrigin(request); const user = await requireUser(); return Response.json(await presignImage(user.id, await request.json())); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not create upload URL." }, { status: 400 }); }
}
