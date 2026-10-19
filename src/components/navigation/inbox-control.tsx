"use client";

import Link from "next/link";
import { Bell, CheckCheck, Clock3, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type InboxItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};
type InboxResponse = { items: InboxItem[]; unreadCount: number };

export function InboxControl({ initialUnreadCount = 0 }: { initialUnreadCount?: number }) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/inbox", { cache: "no-store" });
      const data = (await response.json()) as InboxResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Inbox is unavailable.");
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inbox is unavailable.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let initialLoad: number | undefined;
    if (open) initialLoad = window.setTimeout(() => void load(), 0);
    const poll = () => {
      if (document.visibilityState === "visible") void load();
    };
    const onVisibility = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(poll, 60000);
    document.addEventListener("visibilitychange", onVisibility);
    const outside = (event: PointerEvent) => {
      if (open && !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      if (initialLoad) window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  async function markRead(id?: string) {
    const body = id ? { id } : { all: true };
    setItems((current) => current.map((item) => !id || item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    setUnreadCount((current) => id ? Math.max(0, current - 1) : 0);
    try {
      const response = await fetch("/api/inbox", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await response.json()) as InboxResponse;
      if (!response.ok) throw new Error("Could not update inbox.");
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      void load();
    }
  }

  return (
    <div className="gnav-inbox" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="gnav-icon-control gnav-inbox-trigger"
        aria-label={unreadCount ? `Inbox, ${unreadCount} unread notifications` : "Inbox"}
        aria-expanded={open}
        aria-controls={open ? "gnav-inbox-panel" : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && <span className="gnav-inbox-badge" aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && (
        <section className="gnav-inbox-panel" id="gnav-inbox-panel" aria-label="Inbox notifications">
          <div className="gnav-inbox-head"><div><strong>Your inbox</strong><span>{unreadCount ? `${unreadCount} unread` : "You’re all caught up"}</span></div><button type="button" aria-label="Close inbox" onClick={() => setOpen(false)}><X size={17} aria-hidden="true" /></button></div>
          {unreadCount > 0 && <button type="button" className="gnav-inbox-mark-all" onClick={() => void markRead()}><CheckCheck size={15} aria-hidden="true" /> Mark all as read</button>}
          <div className="gnav-inbox-items" aria-live="polite" aria-busy={loading}>
            {loading && !items.length && <p className="gnav-inbox-message" role="status">Loading your inbox…</p>}
            {error && <p className="gnav-inbox-message" role="alert">{error}<button type="button" onClick={() => void load()}>Try again</button></p>}
            {!loading && !error && !items.length && <div className="gnav-inbox-empty"><Bell size={18} aria-hidden="true" /><p>No updates yet</p><small>Booking and event updates will appear here.</small></div>}
            {items.map((item) => {
              const href = item.href.startsWith("/") && !item.href.startsWith("//") ? item.href : "/account";
              return <Link href={href} key={item.id} className="gnav-inbox-item" data-unread={!item.readAt} onClick={() => { if (!item.readAt) void markRead(item.id); setOpen(false); }}>
                <span className="gnav-inbox-item-icon"><Clock3 size={15} aria-hidden="true" /></span>
                <span className="gnav-inbox-item-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</small></span>
                {!item.readAt && <span className="gnav-inbox-unread-dot" aria-label="Unread" />}
              </Link>;
            })}
          </div>
        </section>
      )}
    </div>
  );
}
