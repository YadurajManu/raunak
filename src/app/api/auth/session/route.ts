import { postLoginPath } from "@/lib/auth-next";
import { z } from "zod";
import { createSession } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { idToken, next, rememberMe } = z
      .object({
        idToken: z.string().min(1),
        next: z.string().max(300).optional(),
        rememberMe: z.boolean().default(true),
      })
      .parse(await request.json());
    const user = await createSession(idToken, rememberMe);
    return Response.json({ ok: true, redirectTo: postLoginPath(user, next) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Sign-in failed." },
      { status: 400 },
    );
  }
}
