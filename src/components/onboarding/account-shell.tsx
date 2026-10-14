import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { ThemeToggle } from "@/components/marketing/footer";
export function AccountShell({
  name,
  active = "Overview",
  organizer = false,
  children,
}: {
  name: string;
  active?: string;
  organizer?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="r-account">
      <header className="r-account-header">
        <Link href="/" className="m-logo">
          <span className="m-logo-mark" aria-hidden="true">
            ◔
          </span>
          {APP_NAME}
        </Link>
        <div>
          <Link
            className="r-view-switch"
            href={organizer ? "/account" : "/dashboard"}
          >
            {organizer ? "← Attendee view" : "Host your own event ↗"}
          </Link>
          <ThemeToggle />
          <details className="r-profile-menu">
            <summary aria-label="Open profile menu">
              <span>{name.slice(0, 1).toUpperCase()}</span>
            </summary>
            <nav aria-label="Profile">
              <b>{name}</b>
              <Link href="/account">My dashboard</Link>
              <Link href="/my-tickets">My tickets</Link>
              <Link href="/account/profile">Edit profile</Link>
              <Link href="/dashboard">Organizer workspace ↗</Link>
            </nav>
          </details>
        </div>
      </header>
      <div className="r-account-grid">
        <aside className="r-account-sidebar">
          <p className="m-mono">
            {organizer ? "ORGANIZER WORKSPACE" : "YOUR LITTLE CORNER"}
          </p>
          {(organizer
            ? [
                { label: "Workspaces", href: "/dashboard" },
                { label: "Create a workspace", href: "/organizer/setup" },
                { label: "Profile", href: "/account/profile" },
              ]
            : [
                { label: "Overview", href: "/account" },
                { label: "My tickets", href: "/my-tickets" },
                { label: "Discover events", href: "/discover" },
                { label: "Profile", href: "/account/profile" },
              ]
          ).map((item) => (
            <Link
              href={item.href}
              className={item.label === active ? "is-active" : ""}
              key={item.href}
            >
              {item.label}
              <span>↗</span>
            </Link>
          ))}
          <div className="r-host-note">
            <span>✳</span>
            <p>Got an idea worth getting together for?</p>
            <Link href="/dashboard">Your first event is free to host ↗</Link>
          </div>
        </aside>
        <section className="r-account-content">{children}</section>
      </div>
    </main>
  );
}
