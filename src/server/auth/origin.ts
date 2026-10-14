export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = process.env.APP_URL;
  if (!origin || !allowed || new URL(origin).origin !== new URL(allowed).origin) {
    throw new Error("Request origin is not allowed.");
  }
}
