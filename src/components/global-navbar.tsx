"use client";
import Link from "next/link";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, ScanLine, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { NavigationLink } from "@/components/navigation-link";
import { ProfileControls } from "@/components/onboarding/profile-controls";
import { ThemeToggle } from "@/components/marketing/footer-controls";
import { APP_NAME } from "@/lib/constants";
import { LocationControl } from "@/components/navigation/location-control";
import { SearchPalette } from "@/components/navigation/search-palette";
import { InboxControl } from "@/components/navigation/inbox-control";
import { MobileTabBar } from "@/components/navigation/mobile-tab-bar";
import type { NavigationConfig } from "@/config/nav";

export function GlobalNavbar({
  user,
  organizations = [],
  preferences,
  navigation,
  city = "",
  todayTicket = null,
  initialUnreadCount = 0,
  loading = false,
}: {
  user: { name: string | null; email: string; avatarKey: string | null } | null;
  organizations?: { id: string; name: string }[];
  preferences?: {
    emailRemindersEnabled: boolean;
    whatsappRemindersEnabled: boolean;
  };
  navigation?: NavigationConfig;
  city?: string | null;
  todayTicket?: { count: number; title: string; href: string } | null;
  initialUnreadCount?: number;
  loading?: boolean;
}) {
  const pathname = usePathname(),
    id = useId();
  const header = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState({ open: false, path: pathname });
  const [signedOut, setSignedOut] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const open = menu.open && menu.path === pathname;
  const primaryLinks = navigation?.primary || [
    { label: "Discover", href: "/discover" },
    ...(user ? [{ label: "My plans", href: "/account" }] : []),
  ];
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
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 8));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, []);
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
  const organizerPage = pathname.startsWith("/dashboard") || pathname.startsWith("/organizer/");
  const action = navigation?.action || (user
    ? { label: "Host an event", href: "/dashboard" }
    : { label: "Get started", href: "/signup" });
  return (
    <>
      <a href="#site-content" className="gnav-skip">
        Skip to content
      </a>
      <header
        className="gnav"
        data-global-navbar
        data-scrolled={scrolled}
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
            aria-label="Primary"
            data-open={open}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a"))
                setMenu({ open: false, path: pathname });
            }}
          >
            {primaryLinks.map((link) => (
              <NavigationLink key={link.href} href={link.href}>
                {link.label}
              </NavigationLink>
            ))}
          </nav>
          <div className="gnav-controls">
            <Suspense fallback={<span className="gnav-location-loading" aria-hidden="true">{city || "All cities"}</span>}>
              <LocationControl initialCity={city || ""} signedIn={Boolean(user)} />
            </Suspense>
            {todayTicket && (
              <Link className="gnav-today-ticket" href={todayTicket.href} title={todayTicket.title}>
                <span className="gnav-today-ticket-dot" aria-hidden="true" />
                <span>{todayTicket.count > 1 ? `${todayTicket.count} tickets today` : todayTicket.title}</span>
                <span className="gnav-today-ticket-action">Show ticket</span>
              </Link>
            )}
            <SearchPalette />
            {user && <InboxControl initialUnreadCount={initialUnreadCount} />}
            {action && !organizerPage && (
              <Link
                href={action.href}
                className={`gnav-host gnav-host-cta${navigation?.audience === "checkin" ? " gnav-role-checkin" : ` gnav-role-${navigation?.audience || (user ? "attendee" : "visitor")}`}`}
              >
                {navigation?.audience === "checkin" && <ScanLine size={16} aria-hidden="true" />}
                {action.label}
              </Link>
            )}
            {!user && <ThemeToggle compact />}
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
                Log in
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
      {todayTicket && (
        <Link className="gnav-today-mobile" href={todayTicket.href} title={todayTicket.title}>
          <span className="gnav-today-ticket-dot" aria-hidden="true" />
          <span>{todayTicket.count > 1 ? `${todayTicket.count} tickets today` : todayTicket.title}</span>
          <span>Show ticket →</span>
        </Link>
      )}
      <MobileTabBar hasTodayTicket={Boolean(todayTicket)} signedIn={Boolean(user)} />
      {signedOut && (
        <div className="gnav-toast" role="status" aria-live="polite">
          Signed out
        </div>
      )}
    </>
  );
}
