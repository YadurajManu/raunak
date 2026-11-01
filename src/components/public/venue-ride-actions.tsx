"use client";

import { useState } from "react";
import { Share2, Navigation, Check, Loader2, MapPin } from "lucide-react";
import { haversineDistance, formatCabEstimate } from "@/lib/transit/geo";
import {
  buildGoogleMapsTransitLink,
  buildUberLink,
  buildOlaLink,
} from "@/lib/transit/links";
import "./venue-transit.css";

export type VenueRideActionsProps = {
  lat: number;
  lng: number;
  venueName?: string | null;
  address?: string | null;
  eventTitle?: string;
  eventUrl?: string;
};

export function VenueRideActions({
  lat,
  lng,
  venueName,
  address,
  eventTitle,
  eventUrl,
}: VenueRideActionsProps) {
  const [openingRide, setOpeningRide] = useState<"Uber" | "Ola" | null>(null);
  const [geoState, setGeoState] = useState<{
    loading: boolean;
    result: string | null;
    error: string | null;
  }>({
    loading: false,
    result: null,
    error: null,
  });
  const [shared, setShared] = useState(false);

  const destination = { lat, lng, venueName, address };
  const googleMapsUrl = buildGoogleMapsTransitLink(destination);
  const uber = buildUberLink(destination);
  const ola = buildOlaLink(destination);

  function handleRide(service: "Uber" | "Ola") {
    const isMobile =
      typeof window !== "undefined" &&
      (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        ("ontouchstart" in window && window.innerWidth < 768));

    const { appUrl, webUrl } = service === "Uber" ? uber : ola;

    setOpeningRide(service);

    if (isMobile) {
      const start = Date.now();
      window.location.href = appUrl;

      // Fallback to web link if app isn't installed and tab stays visible
      const timer = window.setTimeout(() => {
        if (document.visibilityState !== "hidden" && Date.now() - start < 2000) {
          window.location.href = webUrl;
        }
        setOpeningRide(null);
      }, 1200);

      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          window.clearTimeout(timer);
          setOpeningRide(null);
          document.removeEventListener("visibilitychange", onVisibilityChange);
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
    } else {
      window.open(webUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => setOpeningRide(null), 800);
    }
  }

  function handleGetDistance() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState({
        loading: false,
        result: null,
        error: "Location is not supported by your browser.",
      });
      return;
    }

    setGeoState({ loading: true, result: null, error: null });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const straightMeters = haversineDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          lat,
          lng,
        );
        const estimate = formatCabEstimate(straightMeters);
        setGeoState({
          loading: false,
          result: estimate,
          error: null,
        });
      },
      (err) => {
        let msg = "Could not get your location.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Location permission denied.";
        }
        setGeoState({ loading: false, result: null, error: msg });
      },
      { timeout: 10000, enableHighAccuracy: false },
    );
  }

  async function handleShare() {
    const shareUrl =
      eventUrl || (typeof window !== "undefined" ? window.location.href : "");
    const shareText = `Check out ${eventTitle || "this event"} at ${venueName || address || "the venue"}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: eventTitle || "Event venue directions",
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or unsupported, fall back to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      setShared(false);
    }
  }

  return (
    <div className="transit-actions-grid" aria-label="Venue navigation and ride actions">
      {/* Primary Row: Google Maps & Ride options */}
      <div className="transit-action-row">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="transit-btn transit-btn-primary"
        >
          <Navigation size={16} aria-hidden="true" />
          <span>Open in Google Maps ↗</span>
        </a>

        {/* Split Uber | Ola buttons */}
        <div className="transit-split-ride" role="group" aria-label="Book a ride to venue">
          <button
            type="button"
            onClick={() => handleRide("Uber")}
            aria-label="Book an Uber ride"
          >
            {openingRide === "Uber" ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>Opening…</span>
              </>
            ) : (
              <>
                <span aria-hidden="true">🚖</span>
                <span>Uber</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleRide("Ola")}
            aria-label="Book an Ola cab"
          >
            {openingRide === "Ola" ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>Opening…</span>
              </>
            ) : (
              <span>Ola</span>
            )}
          </button>
        </div>
      </div>

      {/* Secondary Row: Distance & Share */}
      <div className="transit-action-row text-xs">
        {/* Geolocation calculation */}
        {geoState.result ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] font-semibold text-[var(--ink)]">
            <span aria-hidden="true">📍</span>
            <span>{geoState.result}</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={geoState.loading}
            onClick={handleGetDistance}
            className="transit-btn transit-btn-secondary !text-xs !py-2 !min-h-[40px]"
          >
            {geoState.loading ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>Calculating distance…</span>
              </>
            ) : (
              <>
                <MapPin size={14} aria-hidden="true" />
                <span>📍 How far from me?</span>
              </>
            )}
          </button>
        )}

        {geoState.error && (
          <span className="text-[var(--danger)] text-xs font-medium self-center">
            {geoState.error}
          </span>
        )}

        {/* Share button */}
        <button
          type="button"
          onClick={handleShare}
          className="transit-btn transit-btn-secondary !text-xs !py-2 !min-h-[40px]"
        >
          {shared ? (
            <>
              <Check size={14} aria-hidden="true" />
              <span>Link copied!</span>
            </>
          ) : (
            <>
              <Share2 size={14} aria-hidden="true" />
              <span>Share</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
