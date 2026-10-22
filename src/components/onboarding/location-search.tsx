"use client";
import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { citySuggestions } from "@/config/cities";
import type { Place } from "@/server/location/service";
import { LocateFixed, LoaderCircle } from "lucide-react";
const LocationMap = dynamic(() => import("./location-map"), { ssr: false });
type Point = { latitude: number; longitude: number };

export function LocationSearch({ value, onChange, onSelect, point, onPick, name = "city", live = false, locate = false }: {
  value: string; onChange: (value: string) => void; onSelect: (place: Place) => void;
  point: Point | null; onPick: (point: Point) => void; name?: string;
  live?: boolean; locate?: boolean;
}) {
  const id = useId();
  const request = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [remote, setRemote] = useState<Place[] | null>(null);
  const [open, setOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const results = remote || citySuggestions(value);
  useEffect(() => () => { request.current?.abort(); if (debounce.current) clearTimeout(debounce.current); }, []);
  function cancelSearch() { request.current?.abort(); if (debounce.current) clearTimeout(debounce.current); }
  function choose(place: Place) {
    cancelSearch(); setBusy(false); setOpen(false); setActive(-1);
    onSelect(place); setMessage(`${place.city}, ${place.region} selected.`);
  }
  async function search(query = value) {
    if (query.trim().length < 3) { setMessage("Enter at least 3 letters, or enter your city manually."); return; }
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "search", query }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error("Search is unavailable. You can enter any city manually.");
      setRemote(result.places); setOpen(true); setActive(-1);
      if (!result.places.length) setMessage("No suggestions found. You can enter any city manually.");
    } catch { if (!controller.signal.aborted) setMessage("Search is unavailable. You can enter any city manually."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function locateDevice() {
    cancelSearch();
    if (!navigator.geolocation) { setMessage("Your browser does not support location. Choose a city instead."); return; }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(async ({coords}) => {
      if (controller.signal.aborted) return;
      const selected = {latitude:coords.latitude,longitude:coords.longitude};
      try {
        const response = await fetch("/api/location", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"reverse",...selected}),signal:controller.signal});
        const data = await response.json();
        if (!response.ok || !data.places?.[0]) throw new Error();
        if (!controller.signal.aborted) choose(data.places[0]);
      } catch { if (!controller.signal.aborted) { onPick(selected); setMessage("Location found. Enter your city if it could not be identified."); } }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }, error => { if (!controller.signal.aborted) { setBusy(false); setMessage(error.code === 1 ? "Location permission was denied. You can still choose your city." : "Your location could not be found. Choose a city instead."); } }, {enableHighAccuracy:false,timeout:10000,maximumAge:60000});
  }
  return <div className="r-city-picker">
    <div className="r-location-input-row"><label htmlFor={id}>City<input id={id} name={name} value={value} maxLength={100} placeholder="Start typing a city…" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open && results.length > 0} aria-controls={`${id}-results`} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
      onFocus={() => setOpen(true)} onBlur={() => { cancelSearch(); setBusy(false); setOpen(false); }} onChange={e => { cancelSearch(); setBusy(false); const query = e.target.value; onChange(query); setRemote(null); setActive(-1); setOpen(true); setMessage(""); if (live && query.trim().length >= 3) debounce.current = setTimeout(() => void search(query), 350); }}
      onKeyDown={e => {
        if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(Math.min(active + 1, results.length - 1)); }
        if (e.key === "ArrowUp" && results.length) { e.preventDefault(); setActive(Math.max(0, active - 1)); }
        if (e.key === "Escape") { setOpen(false); setActive(-1); }
        if (e.key === "Enter") { e.preventDefault(); if (open && results[active]) choose(results[active]); else void search(); }
      }}/></label>{!live && <button type="button" className="r-quiet-button" disabled={busy} onClick={() => void search()}>{busy ? "Searching…" : "Search city"}</button>}{live && busy && <LoaderCircle size={18} aria-label="Searching" />}</div>
    {open && results.length > 0 && <ul id={`${id}-results`} role="listbox" aria-label="City suggestions" className="r-location-results">{results.map((place, index) => <li key={`${place.label}-${place.latitude}`} role="option" id={`${id}-${index}`} aria-selected={active === index} onPointerDown={e => e.preventDefault()} onClick={() => choose(place)}><strong>{place.city}</strong><span>{place.region} · {place.countryCode}</span></li>)}</ul>}
    {locate && <button type="button" className="r-quiet-button" disabled={busy} onClick={locateDevice}><LocateFixed size={16} aria-hidden="true" /> Use my location</button>}
    <div className="r-location-tools"><small>Choose a suggestion or type any city.</small><button type="button" className="r-inline-button" aria-expanded={mapOpen} aria-controls={`${id}-map`} onClick={() => setMapOpen(!mapOpen)}>{mapOpen ? "Hide map" : "Adjust map pin"} {mapOpen ? "−" : "+"}</button></div>
    {mapOpen && <div id={`${id}-map`} className="r-small-map"><LocationMap point={point} onPick={onPick}/></div>}
    {message && <small role="status">{message}</small>}
  </div>;
}
