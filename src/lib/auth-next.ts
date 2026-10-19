export function authNextPath(next?: string) {
  return next &&
    /^\/(?:orders\/[0-9a-f-]{36}|accept-invite\/[A-Za-z0-9_-]{20,100}|checkout\/[a-z0-9-]{1,150}|my-tickets|account(?:\/profile)?|dashboard|organizer\/setup|admin)$/.test(
      next,
    )
    ? next
    : "/account";
}
export function postLoginPath(
  user: { onboardingCompletedAt: Date | null },
  next?: string,
) {
  const destination = authNextPath(next);
  return user.onboardingCompletedAt
    ? destination
    : `/onboarding?next=${encodeURIComponent(destination)}`;
}
