import { z } from "zod";
import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { boundedBody } from "@/server/http/form-data";
import {
  saveNotificationPreferences,
  saveProfile,
  saveCityPreference,
  saveInterests,
} from "@/server/profile/service";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const input: unknown = JSON.parse(
      (await boundedBody(request, 16 * 1024)).toString("utf8"),
    );
    if (input && typeof input === "object" && "interestCategories" in input)
      return Response.json(await saveInterests(user.id, input));
    if (
      input &&
      typeof input === "object" &&
      Object.keys(input).length === 1 &&
      "location" in input
    )
      return Response.json(await saveCityPreference(user.id, input.location));
    if (
      input &&
      typeof input === "object" &&
      ("emailRemindersEnabled" in input || "whatsappRemindersEnabled" in input)
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
