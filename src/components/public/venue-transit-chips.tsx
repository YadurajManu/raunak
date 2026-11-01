"use client";

import { useState } from "react";
import { formatTransitDistance } from "@/lib/transit/geo";
import { VenueHowToReachPanel } from "./venue-how-to-reach-panel";
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
}: VenueTransitChipsProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  const hasMetroData = Boolean(transitStationName);
  const isTooFar = transitDistanceM != null && transitDistanceM > 2500;
  const hasParkingData = Boolean(parkingType && parkingType !== "unknown");

  // If no transit data and no parking data, hide chips
  if (!hasMetroData && !isTooFar && !hasParkingData) {
    return null;
  }

  const parkingLabels: Record<string, string> = {
    free: "Free parking at venue",
    paid: "Paid parking available",
    street: "Street parking only",
    none: "No parking on site",
  };
  const parkingText = parkingType ? parkingLabels[parkingType] : null;

  const distanceText =
    transitDistanceM != null ? formatTransitDistance(transitDistanceM) : null;

  return (
    <>
      <div className="transit-chips-container" aria-label="Transit and parking highlights">
        {/* Metro Chip */}
        {isTooFar ? (
          <button
            type="button"
            className="transit-chip transit-stagger-1"
            aria-expanded={panelOpen}
            aria-haspopup="dialog"
            onClick={() => setPanelOpen(true)}
          >
            <span aria-hidden="true">🚇</span>
            <span>No metro nearby, cab recommended</span>
          </button>
        ) : hasMetroData ? (
          <button
            type="button"
            className="transit-chip transit-stagger-1"
            aria-expanded={panelOpen}
            aria-haspopup="dialog"
            onClick={() => setPanelOpen(true)}
          >
            <span aria-hidden="true">🚇</span>
            <span>
              {distanceText ? `${distanceText} from ` : ""}
              {transitStationName} Metro
            </span>
            {transitLineName && (
              <span className="inline-flex items-center gap-1 opacity-90">
                {transitLineColor && (
                  <span
                    className="transit-line-dot transit-dot-pulse"
                    style={{ backgroundColor: transitLineColor }}
                    aria-hidden="true"
                  />
                )}
                <span>({transitLineName})</span>
              </span>
            )}
          </button>
        ) : null}

        {/* Parking Chip */}
        {hasParkingData && parkingText && (
          <button
            type="button"
            className="transit-chip transit-stagger-2"
            aria-expanded={panelOpen}
            aria-haspopup="dialog"
            onClick={() => setPanelOpen(true)}
          >
            <span aria-hidden="true">🅿️</span>
            <span>{parkingText}</span>
          </button>
        )}
      </div>

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
        transitWalkMin={transitWalkMin}
        parkingType={parkingType}
        parkingNote={parkingNote}
      />
    </>
  );
}
