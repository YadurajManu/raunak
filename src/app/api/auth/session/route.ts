import { z } from "zod";
import { createSession } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { idToken } = z.object({ idToken: z.string().min(1) }).parse(await request.json());
    await createSession(idToken);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Sign-in failed." }, { status: 400 });
  }
}
