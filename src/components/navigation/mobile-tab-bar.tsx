"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, Search, Ticket, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

export function MobileTabBar({ hasTodayTicket = false, signedIn = false }: { hasTodayTicket?: boolean; signedIn?: boolean }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const excluded = pathname.startsWith("/dashboard") || pathname.startsWith("/organizer/") || pathname.startsWith("/checkout") || pathname.startsWith("/t/") || pathname.startsWith("/login") || pathname.startsWith("/signup");

  useEffect(() => {
    const isTextField = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.matches("input, textarea, select, [contenteditable='true']") ||
        target.getAttribute("role") === "textbox");
    const update = () => setHidden(excluded || isTextField(document.activeElement));
    const focus = (event: FocusEvent) => setHidden(excluded || isTextField(event.target));
    const blur = () => window.setTimeout(update, 0);
    update();
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", blur);
    return () => {
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", blur);
    };
  }, [excluded]);

  useEffect(() => {
    const state = (event: Event) => setProfileOpen(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("raunak:profile-menu-state", state);
    return () => window.removeEventListener("raunak:profile-menu-state", state);
  }, []);

  if (excluded || hidden) return null;
  const current = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav className="gnav-mobile-tabs" aria-label="Quick navigation">
      <Link href="/discover" aria-current={current("/discover") ? "page" : undefined} className={current("/discover") ? "is-active" : ""}>
        <Compass size={19} aria-hidden="true" /><span>Discover</span>
      </Link>
      <button type="button" onClick={() => window.dispatchEvent(new Event("raunak:open-search"))} aria-label="Search events">
        <Search size={19} aria-hidden="true" /><span>Search</span>
      </button>
      <Link href="/my-tickets" aria-current={current("/my-tickets") ? "page" : undefined} className={current("/my-tickets") ? "is-active" : ""}>
        <span className="gnav-mobile-tab-icon"><Ticket size={19} aria-hidden="true" />{hasTodayTicket && <i aria-label="Ticket today" />}</span><span>Tickets</span>
      </Link>
      <Link href="/saved" aria-current={current("/saved") ? "page" : undefined} className={current("/saved") ? "is-active" : ""}>
        <Heart size={19} aria-hidden="true" /><span>Saved</span>
      </Link>
      {signedIn ? (
        <button type="button" aria-label="Open profile menu" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => window.dispatchEvent(new Event("raunak:open-profile"))}>
          <UserRound size={19} aria-hidden="true" /><span>Profile</span>
        </button>
      ) : (
        <Link href="/signup"><UserRound size={19} aria-hidden="true" /><span>Get started</span></Link>
      )}
    </nav>
  );
}
