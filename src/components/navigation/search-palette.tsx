"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Suggestion = { label: string; kind: string; href: string };
const RECENTS_KEY = "raunak-search-recents";

export function SearchPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const previousPath = useRef(pathname);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const close = useCallback(() => {
    request.current?.abort();
    setOpen(false);
    requestAnimationFrame(() => {
      const target = trigger.current?.getClientRects().length
        ? trigger.current
        : document.querySelector<HTMLButtonElement>(
            '.gnav-mobile-tabs button[aria-label="Search events"]',
          );
      target?.focus();
    });
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
        if (Array.isArray(saved))
          setRecent(saved.filter((value) => typeof value === "string").slice(0, 5));
      } catch { setRecent([]); }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timeout = requestAnimationFrame(() => input.current?.focus());
    const closeOutside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node))
        close();
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      cancelAnimationFrame(timeout);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open, close]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        input.current?.focus();
      }
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName || "")) {
        event.preventDefault();
        setOpen(true);
        input.current?.focus();
      }
    };
    const openSearch = () => setOpen(true);
    document.addEventListener("keydown", onShortcut);
    window.addEventListener("raunak:open-search", openSearch);
    return () => {
      document.removeEventListener("keydown", onShortcut);
      window.removeEventListener("raunak:open-search", openSearch);
    };
  }, []);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      request.current?.abort();
      const frame = requestAnimationFrame(() => {
        setSuggestions([]);
        setStatus("idle");
      });
      return () => cancelAnimationFrame(frame);
    }
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    const loadingFrame = requestAnimationFrame(() => {
      setSuggestions([]);
      setStatus("loading");
    });
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/discover/suggestions?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("Search suggestions are unavailable.");
        const result = (await response.json()) as { suggestions?: Suggestion[] };
        setSuggestions(result.suggestions || []);
        setStatus("idle");
        setActive(-1);
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, 200);
    return () => {
      cancelAnimationFrame(loadingFrame);
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query, retry]);

  function saveRecent(value: string) {
    const next = [value.trim(), ...recent.filter((item) => item.toLocaleLowerCase() !== value.trim().toLocaleLowerCase())].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
  }

  function submit(value = query) {
    const trimmed = value.trim();
    if (!trimmed) return;
    saveRecent(trimmed);
    setOpen(false);
    router.push(`/discover?q=${encodeURIComponent(trimmed)}`);
  }

  const recentRows = recent.map((label) => ({ label, kind: "Recent search", href: `/discover?q=${encodeURIComponent(label)}` }));
  const groups = query.trim().length >= 2
    ? ["Event", "Venue", "Organizer", "City"].map((kind) => ({
        label: kind === "Venue" ? "Venues" : `${kind}s`,
        items: suggestions.filter((item) => item.kind === kind),
      })).filter((group) => group.items.length)
    : [{ label: "Recent searches", items: recentRows }].filter((group) => group.items.length);
  const rows = groups.flatMap((group) => group.items);

  function activate(item: Suggestion) {
    if (item.kind === "Recent search") {
      submit(item.label);
      return;
    }
    saveRecent(item.label);
    setOpen(false);
    router.push(item.href);
  }

  function onPanelKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" && rows.length) {
      event.preventDefault();
      setActive((current) => (current + 1) % rows.length);
    } else if (event.key === "ArrowUp" && rows.length) {
      event.preventDefault();
      setActive((current) => (current - 1 + rows.length) % rows.length);
    } else if (event.key === "Home" && rows.length) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && rows.length) {
      event.preventDefault();
      setActive(rows.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active >= 0 && rows[active]) activate(rows[active]!);
      else submit();
    } else if (event.key === "Tab") {
      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('input,button,a[href]') || []);
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    }
  }

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="gnav-icon-control gnav-search-trigger"
        aria-label="Search events"
        title="Search events (⌘K)"
        aria-keyshortcuts="/ Control+K Meta+K"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? "gnav-search-dialog" : undefined}
        onClick={() => setOpen(true)}
      >
        <Search size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="gnav-search-scrim" onMouseDown={close}>
          <div
            ref={panel}
            id="gnav-search-dialog"
            className="gnav-search-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Search Raunak events"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={onPanelKeyDown}
          >
            <form
              className="gnav-search-form"
              onSubmit={(event) => { event.preventDefault(); submit(); }}
            >
              <Search size={19} aria-hidden="true" />
              <input
                ref={input}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Events, venues or organizers"
                aria-label="Search events, venues or organizers"
                aria-controls="gnav-search-results"
                aria-autocomplete="list"
                aria-activedescendant={active >= 0 && rows[active] ? `gnav-search-option-${active}` : undefined}
                autoComplete="off"
              />
              <kbd>ESC</kbd>
              <button type="button" className="gnav-search-close" aria-label="Close search" onClick={close}>
                <X size={18} aria-hidden="true" />
              </button>
            </form>
            <div id="gnav-search-results" className="gnav-search-results" aria-busy={status === "loading"}>
              {query.trim().length < 2 && recent.length > 0 && (
                <>
                  <div className="gnav-search-section-head"><span>Recent searches</span><button type="button" onClick={() => { setRecent([]); localStorage.removeItem(RECENTS_KEY); }}>Clear</button></div>
                  <div role="listbox" aria-label="Recent searches">
                    {groups.flatMap((group) => group.items).map((item, index) => (
                      <button key={`${item.kind}-${item.label}`} id={`gnav-search-option-${index}`} type="button" role="option" aria-selected={active === index} className="gnav-search-row" onMouseEnter={() => setActive(index)} onClick={() => activate(item)}>
                        <span>{item.label}</span><small>{item.kind}</small>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {query.trim().length >= 2 && status === "loading" && <div className="gnav-search-skeleton" role="status" aria-label="Loading suggestions"><i /><i /><i /></div>}
              {query.trim().length >= 2 && status === "error" && <p className="gnav-search-message" role="alert">Suggestions are unavailable. Press Enter to search all events. <button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></p>}
              {query.trim().length >= 2 && status === "idle" && suggestions.length > 0 && (
                <div role="listbox" aria-label="Search suggestions">
                  {groups.map((group) => {
                const offset = groups.slice(0, groups.indexOf(group)).reduce((count, item) => count + item.items.length, 0);
                return <div className="gnav-search-section" key={group.label} role="group" aria-label={group.label}>
                  <div className="gnav-search-section-head"><span>{group.label}</span></div>
                  {group.items.map((item, index) => (
                    <button key={`${item.kind}-${item.href}`} id={`gnav-search-option-${offset + index}`} type="button" role="option" aria-selected={active === offset + index} className="gnav-search-row" onMouseEnter={() => setActive(offset + index)} onClick={() => activate(item)}>
                      <span>{item.label}</span><small>{item.kind}</small>
                    </button>
                  ))}
                </div>;
                  })}
                </div>
              )}
              {query.trim().length >= 2 && status === "idle" && !suggestions.length && <p className="gnav-search-message">No matches yet. Try a city or an event type, or press Enter to search.</p>}
            </div>
          <div className="gnav-search-footer"><span>↑ ↓ to navigate</span><span>Enter to search</span><span>ESC to close</span></div>
          </div>
        </div>
      )}
    </>
  );
}
