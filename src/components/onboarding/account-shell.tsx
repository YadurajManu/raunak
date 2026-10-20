import Link from "next/link";
import { Plus } from "lucide-react";
import { NavigationLink } from "@/components/navigation-link";

export function AccountShell({
  organizer = false,
  children,
}: {
  organizer?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="r-account">
      <div className="r-account-grid">
        {organizer && (
          <nav className="r-account-sidebar" aria-label="Organizer navigation">
            <div className="r-account-nav-group">
              <span className="r-account-nav-label">ORGANIZER WORKSPACE</span>
              <div className="r-account-nav-tabs">
                <NavigationLink href="/dashboard" exact>
                  Workspaces
                </NavigationLink>
                <NavigationLink href="/dashboard/settings/whatsapp">
                  WhatsApp integration
                </NavigationLink>
                <NavigationLink href="/dashboard/settings/messages">
                  Message defaults
                </NavigationLink>
                <NavigationLink href="/dashboard/settings/profile">
                  Public profile
                </NavigationLink>
              </div>
            </div>
            <Link href="/organizer/setup" className="r-account-nav-cta">
              <Plus size={14} aria-hidden="true" />
              <span>New workspace</span>
            </Link>
          </nav>
        )}
        <section className="r-account-content">{children}</section>
      </div>
    </div>
  );
}
