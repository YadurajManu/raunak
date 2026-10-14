"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { marketing } from "@/config/marketing";
import { Magnetic } from "@/lib/motion/primitives";

export function MarketingNav() {
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const scroll = () => setCompact(window.scrollY > 36);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const toggleButton = toggle.current;
    const main = document.getElementById("main");
    const footer = document.querySelector<HTMLElement>(".m-footer");
    if (main) main.inert = true;
    if (footer) footer.inert = true;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const initial = requestAnimationFrame(() =>
      document
        .querySelector<HTMLAnchorElement>("#mobile-navigation a")
        ?.focus(),
    );
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const links = Array.from(
          document.querySelectorAll<HTMLElement>("#mobile-navigation a"),
        );
        const first = links[0];
        const last = toggle.current;
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === links[links.length - 1]
        ) {
          event.preventDefault();
          last?.focus();
        } else if (event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          links[links.length - 1]?.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(initial);
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      if (main) main.inert = false;
      if (footer) footer.inert = false;
      toggleButton?.focus();
    };
  }, [open]);
  return (
    <>
      <a className="m-skip" href="#main">
        Skip to content
      </a>
      <header className={`m-nav ${compact ? "is-compact" : ""}`}>
        <nav className="m-nav-inner" aria-label="Main navigation">
          <Link href="/" className="m-logo">
            <span className="m-logo-mark" aria-hidden="true">
              ◔
            </span>
            {APP_NAME}
          </Link>
          <div className="m-nav-links">
            {marketing.nav.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
          <div className="m-nav-actions">
            <Link href="/login" className="m-nav-login">
              Log in
            </Link>
            <Magnetic>
              <Link
                href={marketing.primaryCta.href}
                className="m-button m-nav-cta"
              >
                {marketing.primaryCta.label}
                <span aria-hidden="true">↗</span>
              </Link>
            </Magnetic>
          </div>
          <button
            ref={toggle}
            className="m-menu-toggle"
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            <span />
            <span />
          </button>
        </nav>
      </header>
      <div
        className={`m-mobile-menu ${open ? "is-open" : ""}`}
        id="mobile-navigation"
        data-lenis-prevent
        aria-hidden={!open}
      >
        <nav aria-label="Mobile navigation">
          {marketing.nav.map((item, index) => (
            <a
              href={item.href}
              key={item.href}
              style={{ transitionDelay: `${index * 60}ms` }}
              onClick={() => setOpen(false)}
              tabIndex={open ? 0 : -1}
            >
              {item.label}
              <span>↗</span>
            </a>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            tabIndex={open ? 0 : -1}
          >
            Log in<span>↗</span>
          </Link>
          <Link
            href={marketing.primaryCta.href}
            className="m-button"
            onClick={() => setOpen(false)}
            tabIndex={open ? 0 : -1}
          >
            {marketing.primaryCta.label}
          </Link>
        </nav>
      </div>
    </>
  );
}
