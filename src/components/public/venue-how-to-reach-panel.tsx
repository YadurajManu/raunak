"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CarFront, Check, Copy, TrainFront, X } from "lucide-react";
import { formatTransitDistance, formatWalkingMinutes } from "@/lib/transit/geo";
import { buildGoogleMapsTransitLink } from "@/lib/transit/links";
import "./venue-transit.css";

export type HowToReachProps = {
  isOpen: boolean;
  onClose: () => void;
  venueName?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  transitStationName?: string | null;
  transitLineName?: string | null;
  transitLineColor?: string | null;
  transitDistanceM?: number | null;
  transitWalkMin?: number | null;
  parkingType?: string | null;
  parkingNote?: string | null;
};

export function VenueHowToReachPanel(props: HowToReachProps) {
  const { isOpen, onClose, venueName, address, lat, lng, transitStationName, transitLineName, transitLineColor, transitDistanceM, transitWalkMin, parkingType, parkingNote } = props;
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    function keydown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", keydown); };
  }, [isOpen, onClose]);
  if (!isOpen) return null;

  const addressText = address || venueName || "Address shared by organizer";
  const distance = transitDistanceM == null ? null : formatTransitDistance(transitDistanceM);
  const walk = transitWalkMin == null ? null : formatWalkingMinutes(transitWalkMin);
  const mapUrl = lat != null && lng != null ? buildGoogleMapsTransitLink({ lat, lng, venueName, address }) : null;
  const parkingLabel: Record<string, string> = { free: "Free parking at venue", paid: "Paid parking available", street: "Street parking nearby", none: "No parking at venue" };

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(addressText);
      else {
        const input = document.createElement("textarea"); input.value = addressText; input.style.position = "fixed"; input.style.opacity = "0"; document.body.append(input); input.select(); document.execCommand("copy"); input.remove();
      }
      setCopied(true); window.setTimeout(() => setCopied(false), 1600);
    } catch { setCopied(false); }
  }

  return (
    <div className="transit-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="transit-panel-sheet" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="how-to-reach-title">
        <header className="transit-panel-header">
          <div><span className="transit-kicker">VENUE DETAILS</span><h2 id="how-to-reach-title">Getting there</h2></div>
          <button type="button" className="transit-icon-button" onClick={onClose} aria-label="Close venue details"><X size={19} /></button>
        </header>
        {transitStationName && (
          <div className="transit-panel-row">
            <TrainFront size={20} aria-hidden="true" />
            <div className="transit-info-main"><strong>{transitStationName} Metro</strong>{transitLineName && <span className="transit-line-label" style={{ "--line-color": transitLineColor || "var(--accent)" } as CSSProperties}><i aria-hidden="true" />{transitLineName}</span>}</div>
            <span className="transit-info-distance">{[walk, distance].filter(Boolean).join(" · ")}</span>
          </div>
        )}
        {transitDistanceM != null && transitDistanceM > 2500 && !transitStationName && <div className="transit-panel-row"><TrainFront size={20} aria-hidden="true" /><div className="transit-info-main"><strong>No metro within 2.5 km</strong><span>Consider a cab or auto.</span></div></div>}
        {parkingType && parkingType !== "unknown" && <div className="transit-panel-row"><CarFront size={20} aria-hidden="true" /><div className="transit-info-main"><strong>{parkingLabel[parkingType] || "Parking information"}</strong>{parkingNote && <span>{parkingNote}</span>}</div></div>}
        <div className="transit-address-block"><span className="transit-kicker">ADDRESS</span><p>{addressText}</p></div>
        <div className="transit-panel-actions">
          <button type="button" className="transit-btn transit-btn-secondary" onClick={copy}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "Copied" : "Copy address"}</button>
          {mapUrl && <a className="transit-btn transit-btn-primary" href={mapUrl} target="_blank" rel="noopener noreferrer">Get transit directions</a>}
        </div>
        <p className="transit-live" aria-live="polite">{copied ? "Address copied to clipboard." : ""}</p>
      </section>
    </div>
  );
}
