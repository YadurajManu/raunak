"use client";

import Link from "next/link";
import {
  Bell,
  BriefcaseBusiness,
  CircleHelp,
  LogOut,
  Mail,
  MessageCircle,
  Monitor,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { revealTheme, type ThemePreference } from "@/lib/motion/theme-reveal";

type Organization = { id: string; name: string };
type Preferences = {
  emailRemindersEnabled: boolean;
  whatsappRemindersEnabled: boolean;
};

export function ProfileControls({
  name,
  email,
  avatarUrl,
  organizations = [],
  preferences,
  onSignedOut,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  organizations?: Organization[];
  preferences: Preferences;
  onSignedOut: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState({ open: false, path: pathname });
  const open = menu.open && menu.path === pathname;
  const setOpen = useCallback((value: boolean) => setMenu({ open: value, path: pathname }), [pathname]);
  const [imageFailed, setImageFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedPreferences, setSavedPreferences] = useState(preferences);
  const [saving, setSaving] = useState<keyof Preferences | null>(null);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const menuItems = () =>
    Array.from(
      panel.current?.querySelectorAll<HTMLElement>(
        '[role^="menuitem"]:not([aria-disabled="true"]):not(:disabled)',
      ) ?? [],
    ).filter((item) => item.getClientRects().length > 0);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node))
        setMenu({ open: false, path: pathname });
    };
    document.addEventListener("pointerdown", closeOutside);
    requestAnimationFrame(() => menuItems()[0]?.focus());
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open, pathname]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("raunak:profile-menu-state", { detail: open }));
  }, [open]);

  useEffect(() => {
    const openFromTab = () => setOpen(true);
    window.addEventListener("raunak:open-profile", openFromTab);
    return () => window.removeEventListener("raunak:open-profile", openFromTab);
  }, [setOpen]);

  useEffect(() => {
    const readTheme = () => {
      try {
        const stored = localStorage.getItem("raunak-theme");
        setTheme(stored === "light" || stored === "dark" ? stored : "system");
      } catch { setTheme("system"); }
    };
    readTheme();
    window.addEventListener("raunak-theme", readTheme);
    return () => window.removeEventListener("raunak-theme", readTheme);
  }, []);

  function closeAndRestoreFocus() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  function focusNextItem(direction: 1 | -1, edge?: "first" | "last") {
    const items = menuItems();
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      edge === "first"
        ? 0
        : edge === "last"
          ? items.length - 1
          : (current + direction + items.length) % items.length;
    items[next]?.focus();
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusNextItem(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusNextItem(1, event.key === "Home" ? "first" : "last");
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      const items = menuItems();
      const start = items.indexOf(document.activeElement as HTMLElement) + 1;
      const ordered = [...items.slice(start), ...items.slice(0, start)];
      ordered
        .find((item) =>
          (item.getAttribute("aria-label") || item.textContent || "")
            .trim()
            .toLocaleLowerCase()
            .startsWith(event.key.toLocaleLowerCase()),
        )
        ?.focus();
    }
  }

  async function updatePreference(key: keyof Preferences) {
    const next = !savedPreferences[key];
    setSavedPreferences((current) => ({ ...current, [key]: next }));
    setSaving(key);
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      const result = (await response.json()) as Preferences & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Could not save preference.");
      setSavedPreferences(result);
    } catch (cause) {
      setSavedPreferences((current) => ({ ...current, [key]: !next }));
      setError(
        cause instanceof Error ? cause.message : "Could not save preference.",
      );
    } finally {
      setSaving(null);
    }
  }

  async function chooseTheme(next: ThemePreference, button: HTMLButtonElement) {
    setTheme(next);
    await revealTheme(button, next);
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok)
        throw new Error("Could not sign out. Please try again.");
      const [{ signOut }, { getClientAuth }] = await Promise.all([
        import("firebase/auth"),
        import("@/lib/firebase-client"),
      ]);
      await signOut(await getClientAuth());
      onSignedOut();
      setOpen(false);
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }

  const firstOrganization = organizations[0];
  return (
    <div className="r-profile-menu" ref={root}>
      {open && (
        <button
          type="button"
          className="r-profile-backdrop"
          aria-label="Close account menu"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        />
      )}
      <button
        type="button"
        ref={trigger}
        className="r-profile-trigger"
        aria-label={`Open account menu for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={`${name} · ${email}`}
        onClick={() => setOpen(!open)}
      >
        <span className="r-profile-avatar">
          {(avatarUrl?.startsWith("https://") ||
            avatarUrl?.startsWith("avatars/")) &&
          !imageFailed ? (
            // Firebase supplies remote profile images; a failed image falls back to initials.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                avatarUrl.startsWith("avatars/")
                  ? "/api/profile/avatar"
                  : avatarUrl
              }
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            initials || "?"
          )}
        </span>
      </button>
      <div
        className="r-profile-panel"
        ref={panel}
        id={menuId}
        role="menu"
        aria-label="Account menu"
        hidden={!open}
        onKeyDown={handleMenuKeyDown}
      >
          <div className="r-profile-mobile-links" role="group" aria-label="Main navigation">
            <Link role="menuitem" href="/discover" onClick={() => setOpen(false)}>Discover events</Link>
            <Link role="menuitem" href="/my-tickets" onClick={() => setOpen(false)}>My tickets</Link>
            <Link role="menuitem" href="/saved" onClick={() => setOpen(false)}>Saved</Link>
            <Link role="menuitem" href="/account" onClick={() => setOpen(false)}>My plans</Link>
          </div>
          <div className="r-profile-header" role="group" aria-label="Signed-in account">
            <span className="r-profile-avatar r-profile-avatar-large">
              {(avatarUrl?.startsWith("https://") ||
                avatarUrl?.startsWith("avatars/")) &&
              !imageFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl.startsWith("avatars/") ? "/api/profile/avatar" : avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                initials || "?"
              )}
            </span>
            <span className="r-profile-identity">
              <strong title={name}>{name}</strong>
              <small title={email}>{email}</small>
            </span>
          </div>
          {firstOrganization && (
            <div className="r-profile-org-chip" role="presentation" title={firstOrganization.name}>
              Organizer <span aria-hidden="true">·</span> {firstOrganization.name}
            </div>
          )}

          <div className="r-profile-group" role="group" aria-label="Account">
            <span className="r-profile-group-label" role="presentation">Account</span>
            <Link
              role="menuitem"
              href="/account/profile"
              onClick={() => setOpen(false)}
            >
              <UserRound size={16} aria-hidden="true" />
              <span>Edit profile</span>
              <span className="r-profile-link-arrow" aria-hidden="true">→</span>
            </Link>
            <span className="r-profile-group-label r-profile-pref-label" role="presentation">
              <Bell size={15} aria-hidden="true" /> Notification preferences
            </span>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={savedPreferences.emailRemindersEnabled}
              aria-label="Email event reminders"
              aria-disabled={saving !== null}
              disabled={saving !== null}
              onClick={() => void updatePreference("emailRemindersEnabled")}
            >
              <Mail size={16} aria-hidden="true" />
              <span>Email reminders</span>
              <span className="r-profile-switch" aria-hidden="true" data-checked={savedPreferences.emailRemindersEnabled} />
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={savedPreferences.whatsappRemindersEnabled}
              aria-label="WhatsApp event reminders"
              aria-disabled={saving !== null}
              disabled={saving !== null}
              onClick={() => void updatePreference("whatsappRemindersEnabled")}
            >
              <MessageCircle size={16} aria-hidden="true" />
              <span>WhatsApp reminders</span>
              <span className="r-profile-switch" aria-hidden="true" data-checked={savedPreferences.whatsappRemindersEnabled} />
            </button>
            <small className="r-profile-note" role="presentation">
              Event reminders only. Booking and ticket messages stay on; WhatsApp also needs booking consent.
            </small>
          </div>

          <div className="r-profile-group" role="group" aria-label="Hosting">
            <span className="r-profile-group-label" role="presentation">Hosting</span>
            {organizations.length ? (
              <>
                <Link
                  role="menuitem"
                  href={`/dashboard/events?org=${firstOrganization.id}`}
                  onClick={() => setOpen(false)}
                >
                  <BriefcaseBusiness size={16} aria-hidden="true" />
                  <span>Organizer workspace</span>
                  <span className="r-profile-link-arrow" aria-hidden="true">→</span>
                </Link>
                {organizations.length > 1 && (
                  <div className="r-profile-switcher" role="group" aria-label="Switch workspace">
                    <span className="r-profile-switcher-label" role="presentation">Switch workspace</span>
                    {organizations.map((organization) => (
                      <Link
                        key={organization.id}
                        role="menuitem"
                        href={`/dashboard/events?org=${organization.id}`}
                        onClick={() => setOpen(false)}
                        title={organization.name}
                      >
                        <span>{organization.name}</span>
                        <span className="r-profile-link-arrow" aria-hidden="true">→</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link
                role="menuitem"
                href="/dashboard"
                onClick={() => setOpen(false)}
              >
                <BriefcaseBusiness size={16} aria-hidden="true" />
                <span>Start hosting</span>
                <span className="r-profile-link-arrow" aria-hidden="true">→</span>
              </Link>
            )}
          </div>

          <div className="r-profile-group r-profile-help" role="group" aria-label="Help">
            <Link
              role="menuitem"
              href="/contact"
              onClick={() => setOpen(false)}
            >
              <CircleHelp size={16} aria-hidden="true" />
              <span>Help &amp; contact</span>
              <span className="r-profile-link-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="r-profile-theme-group" role="group" aria-label="Theme">
            <span className="r-profile-group-label" role="presentation">Appearance</span>
            <div className="r-profile-theme-options">
              {([
                ["light", Sun, "Light"],
                ["dark", Moon, "Dark"],
                ["system", Monitor, "System"],
              ] as const).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === value}
                  className="r-profile-theme-option"
                  onClick={(event) => void chooseTheme(value, event.currentTarget)}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="r-profile-signout-group" role="group" aria-label="Session">
            <button
              type="button"
              role="menuitem"
              className="r-profile-signout"
              onClick={() => void logout()}
              disabled={busy}
            >
              <LogOut size={16} aria-hidden="true" />
              <span>{busy ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
          {error && <small className="r-profile-error" role="alert">{error}</small>}
      </div>
    </div>
  );
}
