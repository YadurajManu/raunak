"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Copy, Loader2, MapPin, Navigation, Share2 } from "lucide-react";
import { haversineDistance, formatCabEstimate } from "@/lib/transit/geo";
import { buildGoogleMapsTransitLink, buildUberLink, buildOlaLink } from "@/lib/transit/links";
import "./venue-transit.css";

export type VenueRideActionsProps = { lat: number; lng: number; venueName?: string | null; address?: string | null; eventTitle?: string; eventUrl?: string };

export function VenueRideActions({ lat, lng, venueName, address, eventTitle, eventUrl }: VenueRideActionsProps) {
  const [openingRide, setOpeningRide] = useState<"Uber" | "Ola" | null>(null);
  const [geo, setGeo] = useState<{ loading: boolean; result: string | null; error: string | null }>({ loading: false, result: null, error: null });
  const [copied, setCopied] = useState(false);
  const directionsMenu = useRef<HTMLDetailsElement>(null);
  const destination = { lat, lng, venueName, address };
  const googleMaps = buildGoogleMapsTransitLink(destination);
  const appleMaps = `https://maps.apple.com/?daddr=${encodeURIComponent(`${lat},${lng}`)}&dirflg=r`;
  const uber = buildUberLink(destination);
  const ola = buildOlaLink(destination);

  function preferredDirections() {
    if (typeof navigator === "undefined") return googleMaps;
    return /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) ? appleMaps : googleMaps;
  }
  function ride(service: "Uber" | "Ola") {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const { appUrl, webUrl } = service === "Uber" ? uber : ola;
    setOpeningRide(service);
    if (mobile) {
      window.location.assign(appUrl);
      const timer = window.setTimeout(() => {
        if (document.visibilityState !== "hidden") window.location.assign(webUrl);
        setOpeningRide(null);
      }, 1200);
      const change = () => { if (document.visibilityState === "hidden") { clearTimeout(timer); setOpeningRide(null); document.removeEventListener("visibilitychange", change); } };
      document.addEventListener("visibilitychange", change);
    } else { window.open(webUrl, "_blank", "noopener,noreferrer"); window.setTimeout(() => setOpeningRide(null), 800); }
  }
  function locate() {
    if (!navigator.geolocation) { setGeo({ loading: false, result: null, error: "Location is not supported by your browser." }); return; }
    setGeo({ loading: true, result: null, error: null });
    navigator.geolocation.getCurrentPosition((position) => {
      const meters = haversineDistance(position.coords.latitude, position.coords.longitude, lat, lng);
      setGeo({ loading: false, result: formatCabEstimate(meters), error: null });
    }, (error) => {
      const message = error.code === error.PERMISSION_DENIED ? "Location blocked — enable it in browser settings." : "Could not get your location.";
      setGeo({ loading: false, result: null, error: message });
    }, { timeout: 10000, enableHighAccuracy: false });
  }
  async function copy(value: string) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else { const field = document.createElement("textarea"); field.value = value; field.style.position = "fixed"; field.style.opacity = "0"; document.body.append(field); field.select(); document.execCommand("copy"); field.remove(); }
      setCopied(true); window.setTimeout(() => setCopied(false), 1600);
    } catch { setCopied(false); }
  }
  async function share() {
    const url = eventUrl || window.location.href;
    const title = eventTitle || "Event venue";
    if (navigator.share) {
      try { await navigator.share({ title, text: `Directions to ${venueName || address || "the venue"}`, url }); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    await copy(url);
  }
  const transit = <a className="transit-btn transit-btn-primary" href={preferredDirections()} target="_blank" rel="noopener noreferrer"><Navigation size={17} aria-hidden="true"/><span>Directions</span></a>;

  return (
    <div className="transit-actions-grid" aria-label="Venue navigation and ride actions">
      <div className="transit-action-row">
        <div className="transit-directions-group">
          {transit}
          <details className="transit-directions" ref={directionsMenu}>
            <summary className="transit-directions-toggle" aria-label="Choose directions app"><ChevronDown size={17} aria-hidden="true"/></summary>
            <div className="transit-directions-menu">
              <a href={googleMaps} target="_blank" rel="noopener noreferrer">Google Maps</a>
              <a href={appleMaps} target="_blank" rel="noopener noreferrer">Apple Maps</a>
              <button type="button" onClick={() => { void copy(address || venueName || `${lat}, ${lng}`); directionsMenu.current?.removeAttribute("open"); }}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copied" : "Copy address"}</button>
            </div>
          </details>
        </div>
        <div className="transit-split-ride" role="group" aria-label="Book a ride to the venue">
          {(["Uber", "Ola"] as const).map((service) => <button type="button" key={service} onClick={() => ride(service)} aria-label={`Book an ${service} ride`}>{openingRide === service ? <><Loader2 size={15} className="animate-spin" aria-hidden="true"/>Opening…</> : service}</button>)}
        </div>
        <button type="button" className="transit-btn transit-btn-secondary transit-distance-button" onClick={locate} disabled={geo.loading}>
          {geo.loading ? <Loader2 size={17} className="animate-spin" aria-hidden="true"/> : <MapPin size={17} aria-hidden="true"/>}
          {geo.loading ? "Locating…" : geo.result || "How far from me?"}
        </button>
        <button type="button" className="transit-btn transit-btn-secondary" onClick={() => void share()}>{copied ? <Check size={17} aria-hidden="true"/> : <Share2 size={17} aria-hidden="true"/>}{copied ? "Copied" : "Share"}</button>
      </div>
      <p className="transit-live" aria-live="polite">{geo.error ? <span className="transit-error">{geo.error} {geo.error.startsWith("Location blocked") && <button type="button" onClick={locate}>Retry</button>}</span> : geo.result ? `You are ${geo.result}.` : copied ? "Link copied." : ""}</p>
    </div>
  );
}
