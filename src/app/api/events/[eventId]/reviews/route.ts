import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import {
  EventReviewError,
  saveEventReview,
} from "@/server/events/reviews";

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
    const user = await currentUser();
    if (!user)
      return Response.json({ error: "Sign in to leave a review." }, { status: 401 });

    const eventId = z.uuid().parse((await params).eventId);
    await saveEventReview(eventId, user.id, await request.json());
    return Response.json({ saved: true });
  } catch (error) {
    if (error instanceof EventReviewError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError)
      return Response.json(
        { error: "Choose a rating and keep your note under 1,200 characters." },
        { status: 400 },
      );
    if (error instanceof SyntaxError)
      return Response.json({ error: "Review data must be valid JSON." }, { status: 400 });
    return Response.json(
      { error: "We couldn’t save your review. Please try again." },
      { status: 500 },
    );
  }
}
