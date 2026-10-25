"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin, Navigation, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cities } from "@/config/cities";

type City = { city: string; region: string; latitude: number; longitude: number };
type SavedLocation = { city: string; region: string; countryCode: string; latitude?: number; longitude?: number; radius: number };
const LOCATION_KEY = "raunak-discovery-location";

export function LocationControl({ initialCity = "", signedIn = false }: { initialCity?: string; signedIn?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [radius, setRadius] = useState(25);
  const [hub, setHub] = useState<{ latitude: number; longitude: number } | null>(null);
  const [results, setResults] = useState<City[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const params = new URLSearchParams(queryString);
      const urlCity = params.get("city") || "";
      const urlLat = Number(params.get("lat"));
      const urlLng = Number(params.get("lng"));
      const online = params.get("mode") === "ONLINE";
        const allCities = params.get("allCities") === "1";
      const urlHasCoordinates = params.has("lat") && params.has("lng") && Number.isFinite(urlLat) && Number.isFinite(urlLng);
      try {
        const stored = JSON.parse(localStorage.getItem(LOCATION_KEY) || "null") as SavedLocation | null;
        const profileHub = cities.find((place) => place.city.toLocaleLowerCase("en-IN") === initialCity.toLocaleLowerCase("en-IN"));
        const selected: SavedLocation | null = !online && urlCity
          ? { city: urlCity, region: "", countryCode: "IN", radius: Number(params.get("radius")) || 25 }
          : !online && urlHasCoordinates
            ? { city: params.get("nearCity") || "Nearby", region: "", countryCode: "IN", latitude: urlLat, longitude: urlLng, radius: Number(params.get("radius")) || 25 }
            : !online && !allCities && signedIn && initialCity
              ? { city: initialCity, region: profileHub?.region || "", countryCode: "IN", latitude: profileHub?.latitude, longitude: profileHub?.longitude, radius: 25 }
              : !online && !allCities && stored && typeof stored.city === "string" ? stored : null;
        if (selected) {
          setCity(selected.city);
          setRegion(selected.region || "");
          setRadius([10, 25, 50].includes(selected.radius) ? selected.radius : 25);
          setHub(typeof selected.latitude === "number" && typeof selected.longitude === "number" ? { latitude: selected.latitude, longitude: selected.longitude } : null);
          if (!urlCity && !urlHasCoordinates && !online && pathname.startsWith("/discover")) {
            if (selected.latitude !== undefined && selected.longitude !== undefined) {
              params.set("lat", String(selected.latitude));
              params.set("lng", String(selected.longitude));
              params.set("nearCity", selected.city);
              params.set("radius", String(selected.radius));
            } else {
              params.set("city", selected.city);
            }
            router.replace(`/discover?${params}`, { scroll: false });
          }
        } else if (pathname.startsWith("/discover")) {
          setCity("");
          setRegion("");
          setHub(null);
        }
      } catch {
        try { localStorage.removeItem(LOCATION_KEY); } catch {}
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [initialCity, pathname, queryString, router, signedIn]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    requestAnimationFrame(() => input.current?.focus());
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      const frame = requestAnimationFrame(() => setResults([]));
      return () => cancelAnimationFrame(frame);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/discover/cities?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("City search is unavailable.");
        const data = (await response.json()) as { cities: City[] };
        setResults(data.cities);
      } catch {
        if (!controller.signal.aborted) setError("City suggestions are unavailable. You can still browse all cities.");
      }
    }, 160);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [open, query]);

  function updateDiscoveryUrl(next: { city: string; latitude?: number; longitude?: number; radius: number }) {
    if (!pathname.startsWith("/discover")) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("city"); params.delete("lat"); params.delete("lng"); params.delete("nearCity"); params.delete("radius"); params.delete("page");
    if (next.latitude !== undefined && next.longitude !== undefined) {
      params.delete("allCities");
      params.set("lat", String(next.latitude));
      params.set("lng", String(next.longitude));
      params.set("nearCity", next.city);
      params.set("radius", String(next.radius));
    } else if (next.city) {
      params.delete("allCities");
      params.set("city", next.city);
    } else params.set("allCities", "1");
    router.replace(`/discover${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  async function saveLocation(next: SavedLocation | null) {
    setCity(next?.city || "");
    setRegion(next?.region || "");
    setHub(next && next.latitude !== undefined && next.longitude !== undefined ? { latitude: next.latitude, longitude: next.longitude } : null);
    if (next) {
      setRadius(next.radius);
      localStorage.setItem(LOCATION_KEY, JSON.stringify(next));
      updateDiscoveryUrl({ city: next.city, latitude: next.latitude, longitude: next.longitude, radius: next.radius });
      window.dispatchEvent(new CustomEvent("raunak-discovery-location", { detail: next }));
      if (signedIn) {
        try {
          const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ location: { city: next.city, region: next.region, countryCode: next.countryCode, label: [next.city, next.region, next.countryCode].filter(Boolean).join(", ") } }) });
          if (!response.ok) throw new Error("Your city could not be saved to your account.");
          router.refresh();
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Your city could not be saved to your account."); }
      }
    } else {
      localStorage.removeItem(LOCATION_KEY);
      updateDiscoveryUrl({ city: "", radius });
      window.dispatchEvent(new CustomEvent("raunak-discovery-location", { detail: null }));
      if (signedIn) {
        try { await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ location: null }) }); } catch {}
      }
    }
    setOpen(false);
  }

  async function chooseCity(item: City) {
    setError("");
    await saveLocation({ city: item.city, region: item.region, countryCode: "IN", latitude: item.latitude, longitude: item.longitude, radius });
  }

  async function findMyLocation() {
    setError("");
    if (!navigator.geolocation) { setError("Location access is not supported in this browser. Search for a city instead."); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch("/api/discover/location", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "reverse", latitude: coords.latitude, longitude: coords.longitude }) });
        const data = (await response.json()) as { city?: string; error?: string };
        if (!response.ok || !data.city) throw new Error(data.error || "We couldn’t identify your city.");
        const cityResponse = await fetch(`/api/discover/cities?q=${encodeURIComponent(data.city)}`);
        const cityData = (await cityResponse.json()) as { cities: City[] };
        const result = cityData.cities.find((value) => value.city.toLocaleLowerCase() === data.city!.toLocaleLowerCase()) || cityData.cities[0];
        if (result) await chooseCity(result);
        else await saveLocation({ city: data.city, region: "", countryCode: "IN", radius });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not identify your city.");
      } finally { setBusy(false); }
    }, (cause) => {
      setBusy(false);
      setError(cause.code === cause.PERMISSION_DENIED ? "Location permission was declined. Search for a city instead." : "Your location is unavailable. Search for a city instead.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  const label = city ? `${city}${hub ? ` · ${radius} km` : ""}` : "All cities";
  return (
    <div className="gnav-location" ref={root}>
      <button type="button" className="gnav-location-trigger" aria-label={`Choose location. Current: ${label}`} aria-expanded={open} aria-controls={open ? "gnav-location-picker" : undefined} onClick={() => setOpen((value) => !value)}>
        <MapPin size={17} aria-hidden="true" /><span>{label}</span>
      </button>
      {open && (
        <div className="gnav-location-popover" id="gnav-location-picker" role="dialog" aria-label="Choose discovery location">
          <div className="gnav-location-heading"><strong>Find events around</strong><button type="button" aria-label="Close location picker" onClick={() => setOpen(false)}><X size={16} aria-hidden="true" /></button></div>
          <label className="gnav-location-search"><Search size={16} aria-hidden="true" /><input ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} placeholder="Search an Indian city" aria-label="Search an Indian city" /></label>
          <button type="button" className="gnav-location-detect" disabled={busy} onClick={() => void findMyLocation()}><Navigation size={16} aria-hidden="true" />{busy ? "Finding your city…" : "Use my location"}</button>
          <div className="gnav-location-radius"><label htmlFor="gnav-radius">Nearby radius</label><select id="gnav-radius" value={radius} disabled={!hub} onChange={(event) => { const value = Number(event.target.value); setRadius(value); if (city && hub) void saveLocation({ city, region, countryCode: "IN", latitude: hub.latitude, longitude: hub.longitude, radius: value }); }}><option value={10}>10 km</option><option value={25}>25 km</option><option value={50}>50 km</option></select></div>
          <div className="gnav-location-results" role="group" aria-label="City options">
            <button type="button" aria-pressed={!city} onClick={() => void saveLocation(null)}><span>All cities</span>{!city && <small>Selected</small>}</button>
            {results.map((item) => <button key={`${item.city}-${item.region}`} type="button" aria-pressed={city === item.city} onClick={() => void chooseCity(item)}><span>{item.city}</span><small>{item.region}</small></button>)}
            {initialCity && !city && !query.trim() && <button type="button" aria-pressed="false" onClick={() => void saveLocation({ city: initialCity, region: "", countryCode: "IN", radius })}><span>Use your saved city</span><small>{initialCity}</small></button>}
            {query.length >= 2 && !results.length && <p>No cities found. Try a nearby major city.</p>}
          </div>
          {error && <p className="gnav-location-error" role="alert">{error}</p>}
          <p className="gnav-location-privacy">We use a city-level location for nearby results. Your exact device location is not saved.</p>
        </div>
      )}
    </div>
  );
}
