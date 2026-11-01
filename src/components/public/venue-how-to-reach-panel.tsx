"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
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

export function VenueHowToReachPanel({
  isOpen,
  onClose,
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
}: HowToReachProps) {
  const [copied, setCopied] = useState(false);
  const [isWalkingAnimated, setIsWalkingAnimated] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Esc key & body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Focus trap: focus panel on mount
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  // Walking track animation once via IntersectionObserver
  useEffect(() => {
    if (!isOpen || !trackRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsWalkingAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  if (!isOpen) return null;

  const displayDistance =
    transitDistanceM != null ? formatTransitDistance(transitDistanceM) : null;
  const displayWalkMin =
    transitWalkMin != null ? formatWalkingMinutes(transitWalkMin) : null;

  const parkingLabels: Record<string, string> = {
    free: "Free parking at venue",
    paid: "Paid parking available",
    street: "Street parking only",
    none: "No parking available on site",
  };
  const parkingTitle = parkingType ? parkingLabels[parkingType] : null;

  async function handleCopyAddress() {
    const textToCopy = address || venueName || "";
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const googleMapsTransitUrl =
    lat != null && lng != null
      ? buildGoogleMapsTransitLink({ lat, lng, venueName, address })
      : null;

  return (
    <div
      className="transit-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-reach-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="transit-panel-sheet"
        ref={panelRef}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <h2 id="how-to-reach-title" className="text-lg font-bold text-[var(--ink)]">
            How to reach
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close how to reach panel"
            className="inline-flex items-center justify-center h-11 w-11 rounded-full text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper-2)] transition-colors"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Metro transit details */}
        {transitStationName ? (
          <div className="pt-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                🚇
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-[var(--ink)]">
                    {transitStationName} Metro
                  </span>
                  {transitLineName && (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border border-[var(--border)] font-medium text-[var(--ink)]">
                      {transitLineColor && (
                        <span
                          className="transit-line-dot transit-dot-pulse"
                          style={{ backgroundColor: transitLineColor }}
                          aria-hidden="true"
                        />
                      )}
                      <span>{transitLineName}</span>
                    </span>
                  )}
                </div>
                {(displayDistance || displayWalkMin) && (
                  <p className="text-xs text-[var(--muted)] mt-1 font-medium">
                    {displayDistance}
                    {displayDistance && displayWalkMin ? " · " : ""}
                    {displayWalkMin}
                  </p>
                )}
              </div>
            </div>

            {/* Walking track visualizer */}
            <div className="transit-track-container" ref={trackRef}>
              <div className="flex items-center justify-between text-xs text-[var(--muted)] font-medium">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true">🚇</span> {transitStationName} Metro
                </span>
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true">📍</span> {venueName || "Venue"}
                </span>
              </div>
              <div className="transit-track-line">
                <div
                  className={`transit-track-walker ${isWalkingAnimated ? "is-walking" : ""}`}
                  aria-hidden="true"
                >
                  🚶
                </div>
              </div>
              <div className="text-center text-[11px] text-[var(--muted)] mt-1">
                {displayWalkMin || "~5 min walk"} along pedestrian walkways
              </div>
            </div>
          </div>
        ) : transitDistanceM != null && transitDistanceM > 2500 ? (
          <div className="pt-4 flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">
              🚖
            </span>
            <div>
              <p className="font-semibold text-sm text-[var(--ink)]">
                No metro nearby
              </p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                The nearest metro station is over 2.5 km away. A cab, auto, or ride-share is recommended.
              </p>
            </div>
          </div>
        ) : null}

        {/* Parking section */}
        {parkingTitle && (
          <div className="mt-4 pt-4 border-t border-[var(--line)]">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                🅿️
              </span>
              <div>
                <p className="font-semibold text-sm text-[var(--ink)]">
                  {parkingTitle}
                </p>
                {parkingNote && (
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {parkingNote}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Address and Copy */}
        <div className="mt-4 pt-4 border-t border-[var(--line)]">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
            Venue Address
          </p>
          <p className="text-sm text-[var(--ink)] font-medium">
            {address || venueName || "Address shared by organizer"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAddress}
              className="transit-btn transit-btn-secondary"
            >
              {copied ? (
                <>
                  <Check size={16} aria-hidden="true" />
                  <span>Address copied</span>
                </>
              ) : (
                <>
                  <Copy size={16} aria-hidden="true" />
                  <span>Copy address</span>
                </>
              )}
            </button>
            {googleMapsTransitUrl && (
              <a
                href={googleMapsTransitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transit-btn transit-btn-primary"
              >
                <span>Google Maps Directions ↗</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
