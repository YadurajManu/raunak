import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { confirmImage } from "@/server/media/service";
export async function POST(request: Request) {
  try { requireSameOrigin(request); const user = await requireUser(); const image = await confirmImage(user.id, await request.json()); return Response.json({ id: image.id }, { status: 201 }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not confirm upload." }, { status: 400 }); }
}
