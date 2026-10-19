import { z } from "zod";
import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import {
  saveNotificationPreferences,
  saveProfile,
} from "@/server/profile/service";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const input: unknown = await request.json();
    if (
      input &&
      typeof input === "object" &&
      ("emailRemindersEnabled" in input ||
        "whatsappRemindersEnabled" in input)
    )
      return Response.json(await saveNotificationPreferences(user.id, input));
    return Response.json(await saveProfile(user.id, input));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0].message
            : error instanceof Error
              ? error.message
              : "Could not save profile.",
      },
      { status: 400 },
    );
  }
}
