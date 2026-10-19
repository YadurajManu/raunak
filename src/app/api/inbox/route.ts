import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { listInbox, markInboxRead } from "@/server/notifications/inbox";
import { ZodError } from "zod";

function failure(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message === "Authentication required."
    ? 401
    : message === "Request origin is not allowed."
      ? 403
      : error instanceof ZodError || error instanceof SyntaxError
        ? 400
        : 500;
  return Response.json({ error: message || fallback }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(await listInbox(user.id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return failure(error, "Inbox unavailable.");
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    await markInboxRead(user.id, await request.json());
    return Response.json(await listInbox(user.id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return failure(error, "Inbox update failed.");
  }
}
