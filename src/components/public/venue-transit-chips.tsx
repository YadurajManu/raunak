"use client";

import { CarFront, TrainFront } from "lucide-react";
import { computeWalkingDistance, computeWalkingMinutes, formatTransitDistance } from "@/lib/transit/geo";
import { VenueHowToReachPanel } from "./venue-how-to-reach-panel";
import { useState, type CSSProperties } from "react";
import "./venue-transit.css";

export type VenueTransitChipsProps = {
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
  entryNote?: string | null;
};

export function VenueTransitChips({
  venueName,
  address,
  lat,
  lng,
  transitStationName,
  transitLineName,
  transitLineColor,
  transitDistanceM,
  transitWalkMin,
  parkingType,
  parkingNote,
  entryNote,
}: VenueTransitChipsProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const tooFar = transitDistanceM != null && transitDistanceM > 2500;
  const hasMetro = Boolean(transitStationName) && !tooFar;
  const hasParking = Boolean(parkingType && parkingType !== "unknown");
  // Keep the station row as the single source of truth for transit. If organizer
  // notes repeat a metro/station/walk claim, omit that note instead of showing
  // conflicting directions beside the computed station data.
  const safeEntryNote = transitStationName && /metro|station|yellow line|blue line|pink line|walk/i.test(entryNote || "")
    ? ""
    : entryNote?.trim();
  const hasEntry = Boolean(safeEntryNote);
  if (!hasMetro && !tooFar && !hasParking && !hasEntry) return null;

  const distance = transitDistanceM == null ? null : formatTransitDistance(transitDistanceM);
  const walkMinutes = transitWalkMin ?? (transitDistanceM == null ? null : computeWalkingMinutes(computeWalkingDistance(transitDistanceM)));
  const parkingLabels: Record<string, string> = {
    free: "Free parking at venue",
    paid: "Paid parking available",
    street: "Street parking nearby",
    none: "No parking at venue",
  };

  return (
    <>
      <section className="transit-getting-there" aria-label="Getting there">
        <h3>Getting there</h3>
        {hasMetro ? (
          <button
            type="button"
            className="transit-info-row transit-info-row-button"
            aria-haspopup="dialog"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen(true)}
          >
            <TrainFront size={19} aria-hidden="true" />
            <span className="transit-info-main">
              <strong>{transitStationName} Metro</strong>
              {transitLineName && (
                <span className="transit-line-label" style={{ "--line-color": transitLineColor || "var(--accent)" } as CSSProperties}>
                  <i aria-hidden="true" />{transitLineName}
                </span>
              )}
            </span>
            {(distance || walkMinutes) && (
              <span className="transit-info-distance">
                {walkMinutes ? `${walkMinutes} min walk` : ""}
                {walkMinutes && distance ? " · " : ""}
                {distance}
              </span>
            )}
          </button>
        ) : tooFar ? (
          <div className="transit-info-row">
            <TrainFront size={19} aria-hidden="true" />
            <span className="transit-info-main"><strong>No metro within 2.5 km</strong><span>Consider a cab or auto for the last stretch.</span></span>
          </div>
        ) : null}
        {hasParking && (
          <div className="transit-info-row">
            <CarFront size={19} aria-hidden="true" />
            <span className="transit-info-main"><strong>{parkingLabels[parkingType!] || "Parking information"}</strong>{parkingNote && <span>{parkingNote}</span>}</span>
          </div>
        )}
        {hasEntry && <p className="transit-entry-note"><span>Entry</span>{safeEntryNote}</p>}
      </section>

      <VenueHowToReachPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        venueName={venueName}
        address={address}
        lat={lat}
        lng={lng}
        transitStationName={transitStationName}
        transitLineName={transitLineName}
        transitLineColor={transitLineColor}
        transitDistanceM={transitDistanceM}
        transitWalkMin={walkMinutes}
        parkingType={parkingType}
        parkingNote={parkingNote}
      />
    </>
  );
}
