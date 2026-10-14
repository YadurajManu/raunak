import Link from "next/link";
import { currentUser } from "@/server/auth/session";
import { ProfileControls } from "@/components/onboarding/profile-controls";
import { ThemeToggle } from "@/components/marketing/footer";
import { NavigationLink } from "@/components/navigation-link";
export async function PublicHeader() {
  const user = await currentUser();
  return (
    <header className="r-account-header r-public-header">
      <Link href="/" className="m-logo">
        <span className="m-logo-mark" aria-hidden="true">
          ◔
        </span>
        Raunak
      </Link>
      <nav className="r-public-links" aria-label="Main navigation">
        <NavigationLink href="/discover">Discover events</NavigationLink>
        <NavigationLink href="/my-tickets">My tickets</NavigationLink>
        <NavigationLink href="/saved">Saved</NavigationLink>
      </nav>
      <div className="r-public-controls">
        <Link href="/dashboard" className="r-view-switch">
          Host your own event ↗
        </Link>
        <ThemeToggle />
        {user ? (
          <ProfileControls
            name={user.name || "You"}
            email={user.email}
            avatarUrl={user.avatarKey}
          />
        ) : (
          <Link href="/login" className="m-button m-button-small">
            Sign in ↗
          </Link>
        )}
      </div>
    </header>
  );
}
