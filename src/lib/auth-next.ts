export function authNextPath(next?: string) {
  return next &&
    /^\/(?:accept-invite\/[A-Za-z0-9_-]{20,100}|checkout\/[a-z0-9-]{1,150}|my-tickets)$/.test(
      next,
    )
    ? next
    : "/dashboard";
}
