import { describe, expect, it } from "vitest";
import { navigationFor } from "@/config/nav";

describe("server-derived global navigation", () => {
  it("keeps public visitors on discover with sign-in and getting-started actions", () => {
    expect(navigationFor({ signedIn: false, memberships: [] })).toEqual({
      audience: "visitor",
      primary: [{ label: "Discover", href: "/discover" }],
      action: { label: "Get started", href: "/signup" },
    });
  });

  it.each(["OWNER", "ADMIN", "MANAGER"] as const)(
    "routes %s organizers to their tenant-scoped event creation flow",
    (role) => {
      const config = navigationFor({
        signedIn: true,
        memberships: [{ id: "org-a", name: "First space", role }],
      });
      expect(config.audience).toBe("organizer");
      expect(config.primary).toEqual([
        { label: "Discover", href: "/discover" },
        { label: "My plans", href: "/account" },
        { label: "Dashboard", href: "/dashboard/events?org=org-a" },
      ]);
      expect(config.action).toEqual({
        label: "Create event",
        href: "/dashboard/events/new?org=org-a",
      });
    },
  );

  it("keeps finance members in their dashboard without offering event creation", () => {
    const config = navigationFor({
      signedIn: true,
      memberships: [{ id: "org-b", name: "Finance space", role: "FINANCE" }],
    });
    expect(config.primary.at(-1)).toEqual({
      label: "Dashboard",
      href: "/dashboard/events?org=org-b",
    });
    expect(config.action).toBeNull();
  });

  it("only surfaces scanner access when a real event assignment exists", () => {
    const membership = [{ id: "org-c", name: "Door team", role: "CHECKIN" as const }];
    expect(navigationFor({ signedIn: true, memberships: membership }).audience).toBe("attendee");
    expect(
      navigationFor({
        signedIn: true,
        memberships: membership,
        assignedCheckInEventId: "event-1",
      }),
    ).toEqual({
      audience: "checkin",
      primary: [
        { label: "Discover", href: "/discover" },
        { label: "My plans", href: "/account" },
      ],
        action: { label: "Scan tickets", href: "/dashboard/events/event-1/check-in" },
    });
  });

  it("supports event-specific check-in staff without an organization membership", () => {
    expect(navigationFor({ signedIn: true, memberships: [], assignedCheckInEventId: "event-2" })).toMatchObject({
      audience: "checkin",
      action: { label: "Scan tickets", href: "/dashboard/events/event-2/check-in" },
    });
  });
});
