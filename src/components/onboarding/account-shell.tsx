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
            <p className="m-mono">ORGANIZER WORKSPACE</p>
            <NavigationLink href="/dashboard">Workspaces</NavigationLink>
            <NavigationLink href="/dashboard/settings/whatsapp">WhatsApp integration</NavigationLink>
            <NavigationLink href="/dashboard/settings/messages">Message defaults</NavigationLink>
            <NavigationLink href="/organizer/setup">
              Create a workspace
            </NavigationLink>
          </nav>
        )}
        <section className="r-account-content">{children}</section>
      </div>
    </div>
  );
}
