"use client";
import dynamic from "next/dynamic";
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
  return (
    <LocationMap
      point={{ latitude, longitude }}
      readOnly
      onPick={() => undefined}
    />
  );
}
