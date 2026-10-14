"use client";
import { useEffect, useId, useState } from "react";
export function SearchSuggestions({ initial }: { initial: string }) {
  const id = useId();
  const [query, setQuery] = useState(initial);
  const [items, setItems] = useState<{ label: string; kind: string }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/discover/suggestions?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw new Error();
          setItems((await r.json()).suggestions);
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError("Suggestions unavailable; search still works.");
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return (
    <label className="d-query">
      Search events, venues or organizers
      <input
        name="q"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setItems([]);
          setError("");
        }}
        placeholder="Events, venues, organizers…"
        maxLength={100}
        list={id}
        autoComplete="off"
      />
      <datalist id={id}>
        {items.map((v, i) => (
          <option value={v.label} key={`${v.label}-${i}`}>
            {v.kind}
          </option>
        ))}
      </datalist>
      {error && <small role="status">{error}</small>}
    </label>
  );
}
