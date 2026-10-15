"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function ProfileControls({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email?: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const [imageFailed, setImageFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      ref={menu}
      className="r-profile-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current) {
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="Open profile menu">
        <span>
          {(avatarUrl?.startsWith("https://") ||
            avatarUrl?.startsWith("avatars/")) &&
          !imageFailed ? (
            // Firebase supplies remote profile images; a failed image falls back to initials.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                avatarUrl?.startsWith("avatars/")
                  ? "/api/profile/avatar"
                  : avatarUrl
              }
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "50%",
              }}
            />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </span>
      </summary>
      <nav
        aria-label="Profile"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a") && menu.current)
            menu.current.open = false;
        }}
      >
        <b>{name}</b>
        <small style={{ overflowWrap: "anywhere" }}>{email}</small>
        <Link href="/account">My dashboard</Link>
        <Link href="/my-tickets">My tickets</Link>
        <Link href="/saved">Saved events</Link>
        <Link href="/account/profile">Edit profile</Link>
        <Link href="/dashboard">Organizer workspace ↗</Link>
        <button className="m-button" onClick={logout} disabled={busy}>
          {busy ? "Signing out…" : "Sign out"}
        </button>
        {error && <small role="alert">{error}</small>}
      </nav>
    </details>
  );
}
