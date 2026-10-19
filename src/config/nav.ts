export type OrganizationNavRole = "OWNER" | "ADMIN" | "MANAGER" | "CHECKIN" | "FINANCE";
export type NavigationAudience = "visitor" | "attendee" | "organizer" | "checkin";
export type NavigationMembership = {
  id: string;
  name: string;
  role: OrganizationNavRole;
};

export type NavigationConfig = {
  audience: NavigationAudience;
  primary: { label: string; href: string }[];
  action: { label: string; href: string } | null;
};

const organizerRoles = new Set<OrganizationNavRole>([
  "OWNER",
  "ADMIN",
  "MANAGER",
  "FINANCE",
]);

/** Builds navigation from server-verified membership and event-assignment data. */
export function navigationFor(input: {
  signedIn: boolean;
  memberships: NavigationMembership[];
  assignedCheckInEventId?: string | null;
}): NavigationConfig {
  const organizer = input.memberships.find((membership) =>
    organizerRoles.has(membership.role),
  );
  if (organizer) {
    const canCreate = organizer.role !== "FINANCE";
    const workspace = `/dashboard/events?org=${encodeURIComponent(organizer.id)}`;
    return {
      audience: "organizer",
      primary: [
        { label: "Discover", href: "/discover" },
        { label: "My plans", href: "/account" },
        { label: "Dashboard", href: workspace },
      ],
      action: canCreate
        ? {
            label: "Create event",
            href: `/dashboard/events/new?org=${encodeURIComponent(organizer.id)}`,
          }
        : null,
    };
  }

  if (input.assignedCheckInEventId) {
    const checkInHref = `/dashboard/events/${encodeURIComponent(input.assignedCheckInEventId)}/check-in`;
    return {
      audience: "checkin",
      primary: [
        { label: "Discover", href: "/discover" },
        { label: "My plans", href: "/account" },
      ],
      action: { label: "Scan tickets", href: checkInHref },
    };
  }

  return {
    audience: input.signedIn ? "attendee" : "visitor",
    primary: input.signedIn
      ? [
          { label: "Discover", href: "/discover" },
          { label: "My plans", href: "/account" },
        ]
      : [{ label: "Discover", href: "/discover" }],
    action: input.signedIn
      ? { label: "Host an event", href: "/dashboard" }
      : { label: "Get started", href: "/signup" },
  };
}
