"use client";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
type Suggestion = { label: string; kind: string; href: string };
export function SearchSuggestions({ initial }: { initial: string }) {
  const id = useId(),
    router = useRouter();
  const [query, setQuery] = useState(initial);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(-1);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch(
          `/api/discover/suggestions?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!controller.signal.aborted) {
          setItems(result.suggestions);
          setStatus("ready");
        }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  function choose(item: Suggestion) {
    setOpen(false);
    router.push(item.href);
  }
  return (
    <div className="d-query">
      <label htmlFor={id}>Search events, venues or organizers</label>
      <div className="d-query-input">
        <input
          id={id}
          name="q"
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && query.trim().length >= 2}
          aria-controls={`${id}-suggestions`}
          aria-activedescendant={
            open && active >= 0 ? `${id}-${active}` : undefined
          }
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setItems([]);
            setStatus(
              event.target.value.trim().length >= 2 ? "loading" : "idle",
            );
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive(Math.min(active + 1, items.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive(items.length ? Math.max(0, active - 1) : -1);
            }
            if (event.key === "Escape") {
              setOpen(false);
              setActive(-1);
            }
            if (event.key === "Enter" && open && active >= 0 && items[active]) {
              event.preventDefault();
              choose(items[active]);
            }
          }}
          placeholder="What are you in the mood for?"
          maxLength={100}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="d-query-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setItems([]);
              setStatus("idle");
              setActive(-1);
              document.getElementById(id)?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>
      <div
        className="d-suggestion-panel"
        hidden={!open || query.trim().length < 2}
      >
        <ul
          id={`${id}-suggestions`}
          role="listbox"
          aria-label="Search suggestions"
        >
          {items.map((item, index) => (
            <li
              key={item.href}
              id={`${id}-${index}`}
              role="option"
              aria-selected={active === index}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <span>{item.label}</span>
              <small>{item.kind}</small>
            </li>
          ))}
        </ul>
        <p role="status">
          {status === "loading"
            ? "Finding events…"
            : status === "error"
              ? "Suggestions unavailable. Press Enter to search."
              : items.length === 0
                ? "No suggestions yet. Press Enter to search all events."
                : "Choose a result or press Enter to search all events."}
        </p>
      </div>
    </div>
  );
}
