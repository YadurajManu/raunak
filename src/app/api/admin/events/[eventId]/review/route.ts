import { z } from "zod";
import { PlatformAdminError, requirePlatformAdmin } from "@/server/auth/session";
import { decideEventReview, ReviewActionError } from "@/server/admin/reviews";
import { requireSameOrigin } from "@/server/auth/origin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    try {
      requireSameOrigin(request);
    } catch {
      return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
    }
    const admin = await requirePlatformAdmin();
    const { eventId } = await params;
    const body = await request.json().catch(() => undefined);
    if (!body) return Response.json({ error: "Check the review action and note." }, { status: 400 });
    const event = await decideEventReview(admin.id, eventId, body);
    return Response.json({ id: event.id, status: event.status });
  } catch (error) {
    if (error instanceof PlatformAdminError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError)
      return Response.json({ error: "Check the review action and note." }, { status: 400 });
    if (error instanceof ReviewActionError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Could not save this review decision." }, { status: 500 });
  }
}
