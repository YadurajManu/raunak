"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationLink } from "@/components/navigation-link";
import { ProfileControls } from "@/components/onboarding/profile-controls";
import { ThemeToggle } from "@/components/marketing/footer";
import { APP_NAME } from "@/lib/constants";
export function GlobalNavbar({
  user,
}: {
  user: { name: string | null; email: string; avatarKey: string | null } | null;
}) {
  const pathname = usePathname();
  // Authentication, onboarding and signed admission links keep their focused shells.
  if (
    ["/login", "/signup", "/onboarding"].includes(pathname) ||
    pathname.startsWith("/t/") ||
    pathname.startsWith("/style-guide")
  )
    return null;
  const organizer =
    pathname.startsWith("/dashboard") || pathname.startsWith("/organizer/");
  return (
    <>
      <a href="#site-content" className="gnav-skip">
        Skip to content
      </a>
      <header className="gnav" data-global-navbar>
        <div className="gnav-inner">
          <Link href="/" className="m-logo gnav-logo" aria-label="Raunak home">
            <span className="m-logo-mark" aria-hidden="true">
              ◔
            </span>
            {APP_NAME}
          </Link>
          <nav className="gnav-links" aria-label="Main navigation">
            <NavigationLink href="/discover">Discover events</NavigationLink>
            <NavigationLink href="/my-tickets">My tickets</NavigationLink>
            <NavigationLink href="/saved">Saved</NavigationLink>
            {user && (
              <NavigationLink href="/account">My dashboard</NavigationLink>
            )}
          </nav>
          <div className="gnav-controls">
            <Link
              href={organizer ? "/account" : "/dashboard"}
              className="gnav-host"
            >
              {organizer ? "← Attendee view" : "Host an event ↗"}
            </Link>
            <ThemeToggle />
            {user ? (
              <ProfileControls
                key={user.avatarKey || user.email}
                name={user.name || "You"}
                email={user.email}
                avatarUrl={user.avatarKey}
              />
            ) : (
              <Link
                href="/login"
                className="m-button m-button-small gnav-signin"
              >
                Sign in ↗
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
