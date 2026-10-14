"use client";
import { useId, useState } from "react";
import { cities } from "@/config/cities";
import { eventCategories } from "@/config/event-options";

type Filters = { q?: string; city?: string; category?: string; from?: string; period?: string };
export function DiscoverFilters({ filters, availableCities }: { filters: Filters; availableCities: string[] }) {
  const id = useId();
  const [city, setCity] = useState(filters.city || "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  function openCities() { setOpen(true); try { const saved: unknown = JSON.parse(localStorage.getItem("raunak-recent-cities") || "[]"); if (Array.isArray(saved)) setRecent(saved.filter((v): v is string => typeof v === "string" && v.length <= 100).slice(0, 4)); } catch {} }
  const suggestions = [...new Set([...recent, ...availableCities, ...cities.map(c => c.city)])].filter(c => !city || c.toLowerCase().includes(city.toLowerCase())).slice(0, 7);
  const options = ["", ...suggestions];
  function choose(value: string) { setCity(value); setOpen(false); setActive(-1); }
  function remember() { if (!city.trim()) return; try { localStorage.setItem("raunak-recent-cities", JSON.stringify([city.trim(), ...recent.filter(c => c !== city.trim())].slice(0, 4))); } catch {} }
  const href = (key: string, value: string) => { const query = new URLSearchParams(); for (const [k, v] of Object.entries(filters)) if (v && k !== key && !(key === "period" && k === "from")) query.set(k, v); if (value) query.set(key, value); return `/discover?${query}`; };
  return <div className="d-filters" onFocus={e => { if (e.target instanceof HTMLInputElement && e.target.name === "city") openCities(); }}>
    <form action="/discover" className="d-search" onSubmit={remember}>
      <label className="d-query">Search events<input name="q" defaultValue={filters.q} placeholder="Artists, events, workshops…" maxLength={100}/></label>
      <div className="d-city"><label htmlFor={id}>Where<input id={id} name="city" value={city} maxLength={100} placeholder="All cities" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined} autoComplete="off" onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1); }} onChange={e => { setCity(e.target.value); setOpen(true); setActive(-1); }} onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(Math.min(active + 1, options.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, active - 1)); } if (e.key === "Escape") { setOpen(false); setActive(-1); } if (e.key === "Enter" && open && active >= 0) { e.preventDefault(); choose(options[active]); } }}/></label>
      {city && <button className="d-city-clear" type="button" aria-label="Clear city" onClick={() => choose("")}>×</button>}
      {open && <ul id={`${id}-list`} role="listbox" aria-label="Choose city">{options.map((value, i) => <li key={value} id={`${id}-${i}`} role="option" aria-selected={active === i} onPointerDown={e => e.preventDefault()} onClick={() => choose(value)}><span>{value || "All cities"}</span><small>{value ? recent.includes(value) ? "Recent" : availableCities.includes(value) ? "Events available" : "City" : "Explore everywhere"}</small></li>)}</ul>}</div>
      {filters.category && <input type="hidden" name="category" value={filters.category}/>}{filters.period && <input type="hidden" name="period" value={filters.period}/>}{filters.from && <input type="hidden" name="from" value={filters.from}/>}
      <button className="m-button" type="submit">Find events <span aria-hidden="true">↗</span></button>
    </form>
    <div className="d-date-row"><nav aria-label="Filter by date" className="d-chips"><a href={href("period", "")} aria-current={!filters.period && !filters.from ? "true" : undefined}>Any time</a>{[["today", "Today"], ["tomorrow", "Tomorrow"], ["weekend", "This weekend"], ["month", "This month"]].map(([value, label]) => <a key={value} href={href("period", value)} aria-current={filters.period === value ? "true" : undefined}>{label}</a>)}</nav>
      <form action="/discover" className="d-custom-date"><label>From date<input type="date" name="from" defaultValue={filters.from}/></label>{Object.entries(filters).filter(([k]) => !["from", "period"].includes(k)).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v}/>)}<button type="submit">Apply date</button></form>
    </div>
    <nav aria-label="Filter by category" className="d-chips d-categories"><a href={href("category", "")} aria-current={!filters.category ? "true" : undefined}>All categories</a>{eventCategories.map(category => <a key={category} href={href("category", category)} aria-current={filters.category === category ? "true" : undefined}>{category}</a>)}</nav>
  </div>;
}
