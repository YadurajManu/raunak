"use client";
import { useId, useState } from "react";
import { cities } from "@/config/cities";
import { eventCategories } from "@/config/event-options";

import { discoveryUrl, type DiscoveryFilters } from "@/lib/discovery";
import { SearchSuggestions } from "./search-suggestions";
import {
  Music2,
  Paintbrush,
  Users,
  Utensils,
  Dumbbell,
  Presentation,
  PartyPopper,
  Shapes,
  BookOpen,
} from "lucide-react";
const categoryIcons = [
  Music2,
  BookOpen,
  Users,
  Paintbrush,
  Utensils,
  Dumbbell,
  Presentation,
  PartyPopper,
  Shapes,
];
type Filters = DiscoveryFilters;
export function DiscoverFilters({
  filters,
  availableCities,
}: {
  filters: Filters;
  availableCities: string[];
}) {
  const id = useId();
  const [city, setCity] = useState(filters.city || "");
  const [mode, setMode] = useState(filters.mode);
  const [period, setPeriod] = useState(filters.period);
  const [near, setNear] = useState(
    filters.lat !== undefined ? { lat: filters.lat, lng: filters.lng! } : null,
  );
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  function openCities() {
    setOpen(true);
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("raunak-recent-cities") || "[]",
      );
      if (Array.isArray(saved))
        setRecent(
          saved
            .filter(
              (v): v is string => typeof v === "string" && v.length <= 100,
            )
            .slice(0, 4),
        );
    } catch {}
  }
  const suggestions = [
    ...new Set([...recent, ...availableCities, ...cities.map((c) => c.city)]),
  ]
    .filter((c) => !city || c.toLowerCase().includes(city.toLowerCase()))
    .slice(0, 7);
  const options = ["", ...suggestions];
  function choose(value: string) {
    setNear(null);
    setCity(value);
    if (value) setMode("");
    setOpen(false);
    setActive(-1);
  }
  function remember() {
    if (!city.trim()) return;
    try {
      localStorage.setItem(
        "raunak-recent-cities",
        JSON.stringify(
          [city.trim(), ...recent.filter((c) => c !== city.trim())].slice(0, 4),
        ),
      );
    } catch {}
  }
  const href = (key: string, value: string) =>
    discoveryUrl(filters, {
      [key]: value,
      ...(key === "period" ? { from: "", to: "" } : {}),
    });
  const selected = filters.category.split("|").filter(Boolean);

  return (
    <div
      className="d-filters"
      onFocus={(e) => {
        if (e.target instanceof HTMLInputElement && e.target.name === "city")
          openCities();
      }}
    >
      <form action="/discover" className="d-search" onSubmit={remember}>
        <SearchSuggestions initial={filters.q} />
        <div className="d-city">
          <label htmlFor={id}>
            <span className="d-field-label">Where</span>
            <input
              id={id}
              name="city"
              value={city}
              maxLength={100}
              placeholder="All cities"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              aria-activedescendant={
                open && active >= 0 ? `${id}-${active}` : undefined
              }
              autoComplete="off"
              onFocus={() => setOpen(true)}
              onBlur={() => {
                setOpen(false);
                setActive(-1);
              }}
              onChange={(e) => {
                setCity(e.target.value);
                setNear(null);
                if (e.target.value) setMode("");
                setOpen(true);
                setActive(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  setActive(Math.min(active + 1, options.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive(Math.max(0, active - 1));
                }
                if (e.key === "Escape") {
                  setOpen(false);
                  setActive(-1);
                }
                if (e.key === "Enter" && open && active >= 0) {
                  e.preventDefault();
                  choose(options[active]);
                }
              }}
            />
          </label>
          {city && (
            <button
              className="d-city-clear"
              type="button"
              aria-label="Clear city"
              onClick={() => choose("")}
            >
              ×
            </button>
          )}
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label="Choose city"
            hidden={!open}
          >
            {options.map((value, i) => (
              <li
                key={value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={active === i}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(value)}
              >
                <span>{value || "All cities"}</span>
                <small>
                  {value
                    ? recent.includes(value)
                      ? "Recent"
                      : availableCities.includes(value)
                        ? "Events available"
                        : "City"
                    : "Explore everywhere"}
                </small>
              </li>
            ))}
          </ul>
        </div>

        {near && (
          <>
            <input type="hidden" name="lat" value={near.lat} />
            <input type="hidden" name="lng" value={near.lng} />
          </>
        )}
        {filters.category && (
          <input type="hidden" name="category" value={filters.category} />
        )}
        {filters.organizer && (
          <input type="hidden" name="organizer" value={filters.organizer} />
        )}
        {period && <input type="hidden" name="period" value={period} />}
        <button className="m-button" type="submit">
          Find events <span aria-hidden="true">↗</span>
        </button>
        <details className="market-advanced">
          <summary>Dates, price & format</summary>
          <div className="market-filter-grid">
            <label>
              From date
              <input
                type="date"
                name="from"
                defaultValue={filters.from}
                onChange={() => setPeriod("")}
              />
            </label>
            <label>
              To date
              <input
                type="date"
                name="to"
                defaultValue={filters.to}
                onChange={() => setPeriod("")}
              />
            </label>
            <label>
              Format
              <select
                name="mode"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as Filters["mode"]);
                  if (e.target.value === "ONLINE") {
                    setCity("");
                    setNear(null);
                  }
                }}
              >
                <option value="">All formats</option>
                <option value="IN_PERSON">In person</option>
                <option value="ONLINE">Online</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </label>
            <label>
              Ticket price
              <select name="price" defaultValue={filters.price}>
                <option value="">All prices</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <label>
              Min price · ₹
              <input
                type="number"
                min="0"
                max="1000000"
                name="min"
                defaultValue={filters.min}
              />
            </label>
            <label>
              Max price · ₹
              <input
                type="number"
                min="0"
                max="1000000"
                name="max"
                defaultValue={filters.max}
              />
            </label>
            <label>
              Sort
              <select name="sort" defaultValue={filters.sort}>
                <option value="soonest">Soonest</option>
                <option value="newest">Newest</option>
                <option value="price">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </label>
            <label>
              Nearby radius · km
              <input
                type="number"
                name="radius"
                min="1"
                max="200"
                defaultValue={filters.radius}
              />
            </label>
          </div>
          <p>
            Choosing custom dates replaces the quick date filter. Prices filter
            the lowest visible ticket price.
          </p>
        </details>
      </form>
      <div className="market-near">
        <a
          href={discoveryUrl(filters, {
            mode: "ONLINE",
            city: "",
            lat: undefined,
            lng: undefined,
          })}
          className="r-quiet-button"
        >
          Online events
        </a>
        <button
          type="button"
          className="r-quiet-button"
          onClick={() => {
            if (!navigator.geolocation) {
              setMessage("Location is unavailable. Choose a city instead.");
              return;
            }
            setMessage("Requesting your location…");
            navigator.geolocation.getCurrentPosition(
              (p) => {
                setNear({ lat: p.coords.latitude, lng: p.coords.longitude });
                setCity("");
                setMode("");
                setMessage(
                  "Nearby selected. Press Find events. Your location is only used for this search.",
                );
              },
              () =>
                setMessage(
                  "Location permission was unavailable. You can still choose a city.",
                ),
              { timeout: 10000 },
            );
          }}
        >
          Use my location
        </button>
        {near && (
          <button
            type="button"
            className="r-quiet-button"
            onClick={() => {
              setNear(null);
              setMessage("");
            }}
          >
            Clear nearby
          </button>
        )}
        <small role="status">{message}</small>
      </div>
      <nav aria-label="Filter by date" className="d-chips">
        <a
          href={discoveryUrl(filters, { period: "", from: "", to: "" })}
          aria-current={
            !filters.period && !filters.from && !filters.to ? "true" : undefined
          }
        >
          Any time
        </a>
        {[
          ["today", "Today"],
          ["tomorrow", "Tomorrow"],
          ["weekend", "This weekend"],
          ["month", "This month"],
        ].map(([value, label]) => (
          <a
            key={value}
            href={href("period", value)}
            aria-current={filters.period === value ? "true" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      <nav aria-label="Filter by category" className="d-chips d-categories">
        <a
          href={href("category", "")}
          aria-current={!filters.category ? "true" : undefined}
        >
          All categories
        </a>
        {eventCategories.map((category, index) => {
          const Icon = categoryIcons[index];
          return (
            <a
              key={category}
              href={href(
                "category",
                (selected.includes(category)
                  ? selected.filter((v) => v !== category)
                  : [...selected, category]
                ).join("|"),
              )}
              aria-current={selected.includes(category) ? "true" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{category}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
