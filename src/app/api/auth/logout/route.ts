import { clearSession } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await clearSession();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Logout failed." }, { status: 400 });
  }
}
