"use client";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cities } from "@/config/cities";
import { eventCategories } from "@/config/event-options";
import {
  discoverySchema,
  discoveryUrl,
  type DiscoveryFilters,
} from "@/lib/discovery";
import { SearchSuggestions } from "./search-suggestions";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Dumbbell,
  Globe2,
  LocateFixed,
  MapPin,
  Music2,
  Paintbrush,
  PartyPopper,
  Presentation,
  Shapes,
  SlidersHorizontal,
  Tag,
  Users,
  Utensils,
  X,
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
  const id = useId(),
    router = useRouter();
  const [pending, startTransition] = useTransition();
  const [city, setCity] = useState(filters.city);
  const [mode, setMode] = useState(filters.mode);
  const [period, setPeriod] = useState(filters.period);
  const [near, setNear] = useState(
    filters.lat !== undefined ? { lat: filters.lat, lng: filters.lng! } : null,
  );
  const [advanced, setAdvanced] = useState({
    from: filters.from,
    to: filters.to,
    price: filters.price,
    min: filters.min?.toString() || "",
    max: filters.max?.toString() || "",
    sort: filters.sort,
    radius: String(filters.radius),
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const geoRequest = useRef(0);
  const snapshot = useRef({ city, mode, period, near, advanced });
  const activeCount =
    Number(!!(filters.period || filters.from || filters.to)) +
    Number(
      !!(
        filters.price ||
        filters.min !== undefined ||
        filters.max !== undefined
      ),
    ) +
    Number(!!filters.mode) +
    Number(filters.sort !== "soonest") +
    Number(filters.lat !== undefined);

  function stopLocation() {
    geoRequest.current++;
    setLocating(false);
    setMessage("");
  }
  function changeMode(value: Filters["mode"]) {
    stopLocation();
    setMode(value);
    if (value === "ONLINE") {
      setCity("");
      setNear(null);
    }
  }
  function openDrawer() {
    snapshot.current = { city, mode, period, near, advanced };
    setOpen(false);
    setError("");
    dialog.current?.showModal();
  }
  function cancelDrawer() {
    const previous = snapshot.current;
    stopLocation();
    setCity(previous.city);
    setMode(previous.mode);
    setPeriod(previous.period);
    setNear(previous.near);
    setAdvanced(previous.advanced);
    setError("");
    dialog.current?.close();
  }
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
    stopLocation();
    setNear(null);
    setCity(value);
    setOpen(false);
    setActive(-1);
  }
  function locate() {
    if (!navigator.geolocation) {
      setMessage("Location is unavailable. Choose a city instead.");
      return;
    }
    const request = ++geoRequest.current;
    setLocating(true);
    setMessage("Requesting your location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (request !== geoRequest.current) return;
        setNear({ lat: p.coords.latitude, lng: p.coords.longitude });
        setCity("");
        setLocating(false);
        setMessage(
          "Nearby selected. Press Find events. Your location is only used for this search.",
        );
      },
      () => {
        if (request !== geoRequest.current) return;
        setLocating(false);
        setMessage(
          "Location permission was unavailable. Choose a city instead.",
        );
      },
      { timeout: 10000 },
    );
  }
  const href = (key: string, value: string) =>
    discoveryUrl(filters, {
      [key]: value,
      ...(key === "period" ? { from: "", to: "" } : {}),
    });
  const selected = filters.category.split("|").filter(Boolean);
  return (
    <div className="d-filters">
      <form
        className="d-discovery-form"
        action="/discover"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          const values = Object.fromEntries(
            [...new FormData(event.currentTarget)].filter(
              ([, value]) => value !== "",
            ),
          );
          const parsed = discoverySchema.safeParse(values);
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          if (city.trim())
            try {
              localStorage.setItem(
                "raunak-recent-cities",
                JSON.stringify(
                  [
                    city.trim(),
                    ...recent.filter((c) => c !== city.trim()),
                  ].slice(0, 4),
                ),
              );
            } catch {}
          setError("");
          dialog.current?.close();
          startTransition(() =>
            router.push(discoveryUrl(parsed.data), { scroll: false }),
          );
        }}
      >
        <div className="d-search" role="search" aria-label="Find events">
          <SearchSuggestions initial={filters.q} />
          {mode === "ONLINE" ? (
            <div className="d-online-location">
              <Globe2 size={18} aria-hidden="true" />
              <div>
                <span className="d-field-label">Where</span>
                <strong>Anywhere · Online</strong>
              </div>
            </div>
          ) : (
            <div className="d-city">
              <label htmlFor={id}>
                <span className="d-field-label">
                  <MapPin size={13} aria-hidden="true" /> City or nearby
                </span>
                <input
                  id={id}
                  name="city"
                  value={city}
                  maxLength={100}
                  placeholder={near ? "Near you" : "All cities"}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={open}
                  aria-controls={`${id}-list`}
                  aria-activedescendant={
                    open && active >= 0 ? `${id}-${active}` : undefined
                  }
                  autoComplete="off"
                  onFocus={openCities}
                  onBlur={() => {
                    setOpen(false);
                    setActive(-1);
                  }}
                  onChange={(e) => {
                    stopLocation();
                    setCity(e.target.value);
                    setNear(null);
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
              <div className="d-city-actions">
                {(city || near) && (
                  <button
                    type="button"
                    aria-label="Clear location"
                    title="Clear location"
                    onClick={() => choose("")}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Use my location"
                  title="Use my location"
                  disabled={locating}
                  onClick={locate}
                >
                  <LocateFixed size={17} aria-hidden="true" />
                </button>
              </div>
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
          )}
          {near && mode !== "ONLINE" && (
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
          <button
            className="m-button d-find-button"
            type="submit"
            disabled={pending}
          >
            {pending ? "Finding…" : "Find events"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="d-quick-row">
          <nav className="d-quick-filters" aria-label="Quick event filters">
            <a
              href={discoveryUrl(filters, { period: "", from: "", to: "" })}
              aria-current={
                !filters.period && !filters.from && !filters.to
                  ? "true"
                  : undefined
              }
            >
              <CalendarDays size={15} aria-hidden="true" />
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
            <span className="d-filter-divider" aria-hidden="true" />
            <a
              href={discoveryUrl(filters, {
                price: filters.price === "free" ? "" : "free",
                min: undefined,
                max: undefined,
              })}
              aria-current={filters.price === "free" ? "true" : undefined}
            >
              <Tag size={15} aria-hidden="true" />
              Free
            </a>
            <a
              href={href(
                "mode",
                filters.mode === "IN_PERSON" ? "" : "IN_PERSON",
              )}
              aria-current={filters.mode === "IN_PERSON" ? "true" : undefined}
            >
              <MapPin size={15} aria-hidden="true" />
              In person
            </a>
            <a
              href={href("mode", filters.mode === "ONLINE" ? "" : "ONLINE")}
              aria-current={filters.mode === "ONLINE" ? "true" : undefined}
            >
              <Globe2 size={15} aria-hidden="true" />
              Online
            </a>
          </nav>
          <button
            type="button"
            className="d-filter-trigger"
            aria-label={`Filters${activeCount ? `, ${activeCount} active` : ""}`}
            aria-haspopup="dialog"
            aria-controls={`${id}-drawer`}
            onClick={openDrawer}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filters
            {activeCount > 0 && (
              <span className="d-filter-count" aria-hidden="true">
                {activeCount}
              </span>
            )}
          </button>
        </div>
        <p className="d-location-status" role="status" hidden={!message}>
          {message}
        </p>
        {error && (
          <p role="alert" className="d-filter-error">
            {error}
          </p>
        )}
        <dialog
          ref={dialog}
          id={`${id}-drawer`}
          className="d-filter-drawer"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          onCancel={(e) => {
            e.preventDefault();
            cancelDrawer();
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              const rect = e.currentTarget.getBoundingClientRect();
              if (
                e.clientX < rect.left ||
                e.clientX > rect.right ||
                e.clientY < rect.top ||
                e.clientY > rect.bottom
              )
                cancelDrawer();
            }
          }}
        >
          <header>
            <div>
              <p className="d-drawer-eyebrow">MAKE IT YOUR KIND OF PLAN</p>
              <h2 id={`${id}-title`}>Refine your search</h2>
              <p id={`${id}-description`}>
                A few details to find your next good plan.
              </p>
            </div>
            <button
              type="button"
              className="d-drawer-close"
              aria-label="Close filters"
              onClick={cancelDrawer}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <div className="d-drawer-body">
            <fieldset>
              <legend>
                <CalendarDays size={17} aria-hidden="true" />
                When
              </legend>
              <p>Choose dates, or use the quick date filters.</p>
              <div className="d-drawer-grid">
                <label>
                  From date
                  <input
                    type="date"
                    name="from"
                    value={advanced.from}
                    onChange={(e) => {
                      setAdvanced({ ...advanced, from: e.target.value });
                      setPeriod("");
                    }}
                  />
                </label>
                <label>
                  To date
                  <input
                    type="date"
                    name="to"
                    value={advanced.to}
                    min={advanced.from || undefined}
                    onChange={(e) => {
                      setAdvanced({ ...advanced, to: e.target.value });
                      setPeriod("");
                    }}
                  />
                </label>
              </div>
            </fieldset>
            <fieldset>
              <legend>
                <Globe2 size={17} aria-hidden="true" />
                How you’ll join
              </legend>
              <label>
                Event format
                <select
                  name="mode"
                  value={mode}
                  onChange={(e) =>
                    changeMode(e.target.value as Filters["mode"])
                  }
                >
                  <option value="">All formats</option>
                  <option value="IN_PERSON">In person</option>
                  <option value="ONLINE">Online</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </label>
              <p>
                {mode === "ONLINE"
                  ? "Online events are open to every city. Location filters are off."
                  : "Find a place to go, or something to join from home."}
              </p>
            </fieldset>
            <fieldset>
              <legend>
                <Tag size={17} aria-hidden="true" />
                Your budget
              </legend>
              <label>
                Ticket price
                <select
                  name="price"
                  value={advanced.price}
                  onChange={(e) =>
                    setAdvanced({
                      ...advanced,
                      price: e.target.value as Filters["price"],
                      ...(e.target.value === "free"
                        ? { min: "", max: "" }
                        : {}),
                    })
                  }
                >
                  <option value="">All prices</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
              <div className="d-drawer-grid">
                <label>
                  Minimum price · ₹
                  <input
                    type="number"
                    name="min"
                    min="0"
                    max="1000000"
                    step="any"
                    placeholder="No minimum"
                    disabled={advanced.price === "free"}
                    value={advanced.min}
                    onChange={(e) =>
                      setAdvanced({ ...advanced, min: e.target.value })
                    }
                  />
                </label>
                <label>
                  Maximum price · ₹
                  <input
                    type="number"
                    name="max"
                    min={advanced.min || "0"}
                    max="1000000"
                    step="any"
                    placeholder="No maximum"
                    disabled={advanced.price === "free"}
                    value={advanced.max}
                    onChange={(e) =>
                      setAdvanced({ ...advanced, max: e.target.value })
                    }
                  />
                </label>
              </div>
              <p>Prices use the lowest visible ticket price for each event.</p>
            </fieldset>
            {near && mode !== "ONLINE" && (
              <fieldset>
                <legend>
                  <LocateFixed size={17} aria-hidden="true" />
                  Near you
                </legend>
                <label>
                  Search radius
                  <select
                    name="radius"
                    value={advanced.radius}
                    onChange={(e) =>
                      setAdvanced({ ...advanced, radius: e.target.value })
                    }
                  >
                    {[
                      ...new Set([
                        5,
                        10,
                        25,
                        50,
                        100,
                        200,
                        Number(advanced.radius),
                      ]),
                    ]
                      .sort((a, b) => a - b)
                      .map((value) => (
                        <option key={value} value={value}>
                          {value} km
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="d-drawer-link"
                  onClick={() => {
                    stopLocation();
                    setNear(null);
                  }}
                >
                  Clear nearby location
                </button>
              </fieldset>
            )}
            <fieldset>
              <legend>
                <SlidersHorizontal size={17} aria-hidden="true" />
                Show first
              </legend>
              <label>
                Sort events
                <select
                  name="sort"
                  value={advanced.sort}
                  onChange={(e) =>
                    setAdvanced({
                      ...advanced,
                      sort: e.target.value as Filters["sort"],
                    })
                  }
                >
                  <option value="soonest">Soonest</option>
                  <option value="newest">Newest</option>
                  <option value="price">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                </select>
              </label>
            </fieldset>
            {error && (
              <p role="alert" className="d-filter-error">
                {error}
              </p>
            )}
          </div>
          <footer>
            <button
              type="button"
              className="d-drawer-reset"
              onClick={() => {
                changeMode("");
                setNear(null);
                setPeriod("");
                setAdvanced({
                  from: "",
                  to: "",
                  price: "",
                  min: "",
                  max: "",
                  sort: "soonest",
                  radius: "25",
                });
                setError("");
              }}
            >
              Reset filters
            </button>
            <button type="submit" className="m-button" disabled={pending}>
              <Check size={17} aria-hidden="true" />
              Apply filters
            </button>
          </footer>
        </dialog>
      </form>
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
