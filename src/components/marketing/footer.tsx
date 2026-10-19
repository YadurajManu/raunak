"use client";
import { useId, useSyncExternalStore } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { marketing } from "@/config/marketing";
import { useReducedMotion } from "@/lib/motion/reduced";
import { ArrowUp, Sun } from "lucide-react";
import { revealTheme } from "@/lib/motion/theme-reveal";

function subscribeTheme(callback: () => void) {
  const query = matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("raunak-theme", callback);
  query.addEventListener("change", callback);
  return () => {
    window.removeEventListener("raunak-theme", callback);
    query.removeEventListener("change", callback);
  };
}
function darkTheme() {
  return (
    document.documentElement.dataset.marketingTheme === "dark" ||
    (!document.documentElement.dataset.marketingTheme &&
      matchMedia("(prefers-color-scheme: dark)").matches)
  );
}
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const dark = useSyncExternalStore(subscribeTheme, darkTheme, () => false);
  const eclipseMask = useId();
  return (
    <button
      type="button"
      className={compact ? "gnav-theme" : "m-theme-toggle m-sticker"}
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // Focusing a sticky header must not scroll before the reveal is captured.
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
      }}
      onClick={(event) =>
        void revealTheme(event.currentTarget, dark ? "light" : "dark")
      }
    >
      <span
        className="theme-reveal-icon"
        data-theme={dark ? "dark" : "light"}
        aria-hidden="true"
      >
        <Sun className="theme-eclipse-rays" size={18} strokeWidth={1.7} />
        <svg
          className="theme-eclipse-disc"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          focusable="false"
        >
          <defs>
            <mask
              id={eclipseMask}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="24"
              height="24"
            >
              <rect width="24" height="24" fill="var(--mask-visible)" />
              <circle
                className="theme-eclipse-shadow"
                cx="12"
                cy="12"
                r="7"
                fill="var(--mask-hidden)"
              />
            </mask>
          </defs>
          <circle cx="12" cy="12" r="6" mask={`url(#${eclipseMask})`} />
        </svg>
      </span>
      {!compact && <span>{dark ? "LIGHT" : "DARK"}</span>}
    </button>
  );
}
export function MarketingFooter() {
  const reduced = useReducedMotion();
  return (
    <footer className="m-footer">
      <FooterDivider />
      <div className="m-container">
        <nav className="m-footer-links" aria-label="Footer navigation">
          {marketing.footer.map((group) => (
            <div key={group.label}>
              <h3 className="m-mono">{group.label}</h3>
              {group.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href.startsWith("#") ? `/${link.href}` : link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="m-footer-utility">
          <div className="m-footer-meta">
            <p>Made in India, for events everywhere.</p>
            <p>
              © {new Date().getFullYear()} {APP_NAME}
            </p>
          </div>
          <div className="m-footer-controls">
            <ThemeToggle compact />
            <button
              type="button"
              className="m-back-top m-mono"
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: reduced ? "instant" : "smooth",
                })
              }
            >
              Back to top <ArrowUp size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function FooterDivider() {
  return (
    <svg
      className="m-footer-divider"
      width="100%"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="100%" height="8" fill="var(--paper)" />
      <line
        x1="16"
        x2="100%"
        y1="8"
        y2="8"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 6"
      />
      <circle cx="0" cy="8" r="8" fill="var(--paper)" />
      <circle cx="100%" cy="8" r="8" fill="var(--paper)" />
    </svg>
  );
}
