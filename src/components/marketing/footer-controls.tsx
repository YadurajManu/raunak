"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { ArrowUp, Moon, Sun, Monitor } from "lucide-react";
import { revealTheme, type ThemePreference } from "@/lib/motion/theme-reveal";
import { useReducedMotion } from "@/lib/motion/reduced";

function subscribe(callback: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("raunak-theme", callback);
  query.addEventListener("change", callback);
  return () => {
    window.removeEventListener("raunak-theme", callback);
    query.removeEventListener("change", callback);
  };
}
function snapshot(): ThemePreference {
  const value = document.documentElement.dataset.marketingTheme;
  return value === "light" || value === "dark" ? value : "system";
}

export function FooterControls() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "system");
  const reduced = useReducedMotion();
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const update = () => setShowTop(document.documentElement.scrollHeight >= window.innerHeight * 2);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return <div className="m-footer-controls">
    <div className="m-footer-theme" role="group" aria-label="Colour theme">
      {([ ["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor] ] as const).map(([value, label, Icon]) => <button key={value} type="button" aria-pressed={theme === value} onClick={(event) => void revealTheme(event.currentTarget, value)}><Icon size={14} aria-hidden="true" />{label}</button>)}
    </div>
    {showTop && <button type="button" className="m-back-top" onClick={() => window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" })}>Back to top <ArrowUp size={15} aria-hidden="true" /></button>}
  </div>;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "system");
  const eclipseMask = useId();
  const dark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const actionLabel = dark ? "Switch to light mode" : "Switch to dark mode";
  return <button type="button" className={compact ? "gnav-theme" : "m-theme-toggle m-sticker"} aria-label={actionLabel} title={actionLabel} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); } }} onClick={(event) => void revealTheme(event.currentTarget, dark ? "light" : "dark")}>
    <span className="theme-reveal-icon" data-theme={dark ? "dark" : "light"} aria-hidden="true"><Sun className="theme-eclipse-rays" size={18} strokeWidth={1.7} /><svg className="theme-eclipse-disc" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" focusable="false"><defs><mask id={eclipseMask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="var(--mask-visible)" /><circle className="theme-eclipse-shadow" cx="12" cy="12" r="7" fill="var(--mask-hidden)" /></mask></defs><circle cx="12" cy="12" r="6" mask={`url(#${eclipseMask})`} /></svg></span>
    {!compact && <span>{dark ? "LIGHT" : "DARK"}</span>}
  </button>;
}
