"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { NavigationLink } from "@/components/navigation-link";
import { ProfileControls } from "@/components/onboarding/profile-controls";
import { ThemeToggle } from "@/components/marketing/footer";
import { APP_NAME } from "@/lib/constants";

export function GlobalNavbar({
  user,
  organizations = [],
  preferences,
  loading = false,
}: {
  user: { name: string | null; email: string; avatarKey: string | null } | null;
  organizations?: { id: string; name: string }[];
  preferences?: {
    emailRemindersEnabled: boolean;
    whatsappRemindersEnabled: boolean;
  };
  loading?: boolean;
}) {
  const pathname = usePathname(),
    id = useId();
  const header = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState({ open: false, path: pathname });
  const [signedOut, setSignedOut] = useState(false);
  const open = menu.open && menu.path === pathname;
  const hasOrganization = organizations.length > 0;
  if (menu.path !== pathname) setMenu({ open: false, path: pathname });
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node))
        setMenu({ open: false, path: pathname });
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [pathname]);
  useEffect(() => {
    if (!signedOut) return;
    const timeout = window.setTimeout(() => setSignedOut(false), 2800);
    return () => window.clearTimeout(timeout);
  }, [signedOut]);
  // Authentication, onboarding and signed admission links keep their focused shells.
  if (
    ["/login", "/signup", "/onboarding"].includes(pathname) ||
    pathname.startsWith("/t/") ||
    pathname.startsWith("/style-guide")
  )
    return null;
  const organizer =
    pathname.startsWith("/dashboard") || pathname.startsWith("/organizer/");
  const hostHref = organizer ? "/account" : "/dashboard";
  const hostLabel = organizer
    ? "My plans"
    : hasOrganization
      ? "Organizer dashboard"
      : "Host an event";
  return (
    <>
      <a href="#site-content" className="gnav-skip">
        Skip to content
      </a>
      <header
        className="gnav"
        data-global-navbar
        ref={header}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            setMenu({ open: false, path: pathname });
            trigger.current?.focus();
          }
        }}
      >
        <div className="gnav-inner">
          <Link href="/" className="gnav-logo" aria-label="Raunak home">
            <BrandMark className="gnav-logo-mark" />
            {APP_NAME}
          </Link>
          <nav
            id={id}
            className="gnav-links"
            aria-label="Main navigation"
            data-open={open}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a"))
                setMenu({ open: false, path: pathname });
            }}
          >
            <NavigationLink href="/discover">Discover events</NavigationLink>
            <NavigationLink href="/my-tickets">My tickets</NavigationLink>
            <NavigationLink href="/saved">Saved</NavigationLink>
            {user && <NavigationLink href="/account">My plans</NavigationLink>}
            <Link
              className={`gnav-mobile-host${organizer ? "" : " gnav-host-cta"}`}
              href={hostHref}
            >
              {hostLabel}
              {organizer && <ArrowLeft size={16} aria-hidden="true" />}
            </Link>
          </nav>
          <div className="gnav-controls">
            <Link
              href={hostHref}
              className={`gnav-host${organizer ? "" : " gnav-host-cta"}`}
            >
              {hostLabel}
              {organizer && <ArrowLeft size={16} aria-hidden="true" />}
            </Link>
            <ThemeToggle compact />
            {user ? (
              <ProfileControls
                key={user.avatarKey || user.email}
                name={user.name || "You"}
                email={user.email}
                avatarUrl={user.avatarKey}
                organizations={organizations}
                preferences={preferences || {
                  emailRemindersEnabled: true,
                  whatsappRemindersEnabled: false,
                }}
                onSignedOut={() => setSignedOut(true)}
              />
            ) : loading ? (
              <span className="gnav-session-skeleton" aria-label="Loading account" />
            ) : (
              <Link href="/login" className="gnav-signin">
                Sign in
              </Link>
            )}
            <button
              type="button"
              className="gnav-menu-toggle"
              ref={trigger}
              aria-label={
                open ? "Close navigation menu" : "Open navigation menu"
              }
              aria-expanded={open}
              aria-controls={id}
              onClick={() => {
                setMenu({ open: !open, path: pathname });
                if (!open)
                  requestAnimationFrame(() =>
                    header.current
                      ?.querySelector<HTMLAnchorElement>(".gnav-links a")
                      ?.focus(),
                  );
              }}
            >
              {open ? (
                <X size={20} aria-hidden="true" />
              ) : (
                <Menu size={20} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>
      {signedOut && (
        <div className="gnav-toast" role="status" aria-live="polite">
          Signed out
        </div>
      )}
    </>
  );
}
