import { z } from "zod";
import { db } from "@/server/db/client";
import { currentUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { publicListing } from "@/server/public/events";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await currentUser();
    if (!user)
      return Response.json(
        { error: "Sign in to save events." },
        { status: 401 },
      );
    const eventId = z.uuid().parse((await params).eventId);
    const { saved } = z
      .object({ saved: z.boolean() })
      .parse(await request.json());
    if (saved) {
      if (
        !(await db.event.findFirst({
          where: { ...publicListing, id: eventId },
        }))
      )
        return Response.json(
          { error: "This event is unavailable." },
          { status: 404 },
        );
      await db.savedEvent.upsert({
        where: { userId_eventId: { userId: user.id, eventId } },
        create: { userId: user.id, eventId },
        update: {},
      });
    } else
      await db.savedEvent.deleteMany({ where: { userId: user.id, eventId } });
    return Response.json({ saved });
  } catch {
    return Response.json(
      { error: "Could not update saved event. Please retry." },
      { status: 400 },
    );
  }
}
