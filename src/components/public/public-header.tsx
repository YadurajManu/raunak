import Link from "next/link";
import { currentUser } from "@/server/auth/session";
import { ProfileControls } from "@/components/onboarding/profile-controls";
import { ThemeToggle } from "@/components/marketing/footer";
export async function PublicHeader() {
  const user = await currentUser();
  return (
    <header className="r-account-header">
      <Link href="/" className="m-logo">
        <span className="m-logo-mark" aria-hidden="true">
          ◔
        </span>
        Raunak
      </Link>
      <div role="navigation" aria-label="Main navigation">
        <Link href="/discover">Discover events</Link>
        <Link href="/my-tickets">My tickets</Link>
        <Link href="/saved">Saved</Link>
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
