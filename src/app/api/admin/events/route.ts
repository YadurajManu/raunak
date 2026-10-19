import { z } from "zod";
import { PlatformAdminError, requirePlatformAdmin } from "@/server/auth/session";
import { listReviewEvents, reviewQueueSchema } from "@/server/admin/reviews";

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const requested = new URL(request.url).searchParams.get("status") ?? "PENDING_REVIEW";
    const status = reviewQueueSchema.parse(requested);
    return Response.json(
      { events: await listReviewEvents(status) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return adminError(error);
  }
}

function adminError(error: unknown) {
  if (error instanceof PlatformAdminError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json({ error: "Choose a valid review queue." }, { status: 400 });
  return Response.json({ error: "Could not load the review queue." }, { status: 500 });
}
