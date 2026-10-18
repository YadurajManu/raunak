import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { checkIn, searchAttendees } from "@/server/checkin/service";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return Response.json(
      {
        error:
          "Enter a valid event and at least two search characters, or a valid ticket QR.",
      },
      { status: 400, headers },
    );
  if (
    error instanceof Error &&
    [
      "Access denied.",
      "Event not found.",
      "Request origin is not allowed.",
    ].includes(error.message)
  )
    return Response.json(
      {
        error:
          "You do not have check-in access to this event. Ask an organizer to assign you.",
      },
      { status: 403, headers },
    );
  return Response.json(
    {
      error:
        "The check-in service is temporarily unavailable. Do not admit the ticket until a result is confirmed. Please retry.",
    },
    { status: 503, headers },
  );
}
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user)
      return Response.json(
        {
          error:
            "Your session has expired. Sign in again to continue check-in.",
        },
        { status: 401, headers },
      );
    const query = new URL(request.url).searchParams;
    return Response.json(
      await searchAttendees(user.id, {
        eventId: query.get("eventId"),
        q: query.get("q"),
      }),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await currentUser();
    if (!user)
      return Response.json(
        {
          error:
            "Your session has expired. Sign in again to continue check-in.",
        },
        { status: 401, headers },
      );
    return Response.json(await checkIn(user.id, await request.json()), {
      headers,
    });
  } catch (error) {
    return failure(error);
  }
}
