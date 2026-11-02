import { createHash } from "node:crypto";
import IORedis from "ioredis";
import { z } from "zod";
import {
  createSession,
  currentUser,
  clearSession,
} from "@/server/auth/session";
import { boundedBody } from "@/server/http/form-data";

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});
const input = z.object({ idToken: z.string().min(1).max(12000) });
const headers = { "Cache-Control": "private, no-store" };
const increment =
  "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return n";

// Native clients have neither header. Browser sign-in keeps its existing CSRF checks.
function nativeRequest(request: Request) {
  return (
    !request.headers.has("origin") && !request.headers.has("sec-fetch-site")
  );
}
function profile(user: { id: string; name: string | null; email: string }) {
  return { id: user.id, name: user.name, email: user.email };
}
export async function POST(request: Request) {
  if (!nativeRequest(request))
    return Response.json(
      { error: "Use the website sign-in flow." },
      { status: 403, headers },
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json(
      { error: "A JSON sign-in request is required." },
      { status: 415, headers },
    );
  try {
    const { idToken } = input.parse(
      JSON.parse((await boundedBody(request, 16 * 1024)).toString("utf8")),
    );
    const address =
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const key = createHash("sha256").update(address).digest("hex");
    let count: unknown;
    try {
      count = await redis.eval(increment, 1, `mobile-session:${key}`);
    } catch {
      return Response.json(
        { error: "Sign-in is temporarily unavailable. Please try again." },
        { status: 503, headers },
      );
    }
    if (Number(count) > 20)
      return Response.json(
        { error: "Too many sign-in attempts. Try again in 15 minutes." },
        { status: 429, headers: { ...headers, "Retry-After": "900" } },
      );
    const user = await createSession(idToken, true);
    return Response.json({ user: profile(user) }, { headers });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return Response.json(
        { error: "The sign-in request is invalid." },
        { status: 400, headers },
      );
    return Response.json(
      { error: "Could not complete sign-in. Please sign in again." },
      { status: 401, headers },
    );
  }
}
export async function GET() {
  try {
    const user = await currentUser();
    return user
      ? Response.json({ user: profile(user) }, { headers })
      : Response.json(
          { error: "Please sign in again." },
          { status: 401, headers },
        );
  } catch {
    return Response.json(
      { error: "Your account could not be loaded. Please try again." },
      { status: 503, headers },
    );
  }
}
export async function DELETE(request: Request) {
  if (!nativeRequest(request))
    return Response.json(
      { error: "Use the website sign-out flow." },
      { status: 403, headers },
    );
  await clearSession();
  return Response.json({ ok: true }, { headers });
}
