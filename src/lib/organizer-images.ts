export function organizerLogoUrl(
  orgId: string | undefined,
  key?: string | null,
) {
  if (!key) return null;
  if (/^https?:\/\//i.test(key) || key.startsWith("/api/orgs/")) return key;
  return orgId ? `/api/orgs/${orgId}/logo` : null;
}

export function organizerCoverUrl(
  orgId: string,
  key?: string | null,
) {
  if (!key) return null;
  if (/^https?:\/\//i.test(key) || key.startsWith("/api/orgs/")) return key;
  return `/api/orgs/${orgId}/cover`;
}
