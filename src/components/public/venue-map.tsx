"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
const LocationMap = dynamic(
  () => import("@/components/onboarding/location-map"),
  { ssr: false },
);
export function VenueMap({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = root.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);
  return (
    <div ref={root} className="event-lazy-map" aria-label="Map to event venue">
      {visible ? (
        <LocationMap
          point={{ latitude, longitude }}
          readOnly
          onPick={() => undefined}
        />
      ) : (
        <button
          type="button"
          className="event-map-load"
          onClick={() => setVisible(true)}
        >
          Show map
          <span>Interactive map loads when you reach this section.</span>
        </button>
      )}
    </div>
  );
}
