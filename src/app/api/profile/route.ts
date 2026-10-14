import { z } from "zod";
import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { saveProfile } from "@/server/profile/service";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    return Response.json(await saveProfile(user.id, await request.json()));
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
