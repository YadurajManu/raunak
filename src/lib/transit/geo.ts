/**
 * Transit distance & walking time utilities for Raunak events.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates the great-circle distance between two points on Earth using the Haversine formula.
 * Returns straight-line distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Computes walking distance in meters (approx. 1.3x straight-line distance to account for streets).
 */
export function computeWalkingDistance(straightMeters: number): number {
  return Math.round(straightMeters * 1.3);
}

/**
 * Computes walking time in minutes based on ~80 meters per minute walking speed.
 */
export function computeWalkingMinutes(walkingMeters: number): number {
  return Math.max(1, Math.round(walkingMeters / 80));
}

/**
 * Formats distance with a tilde prefix, e.g. "~400 m" or "~1.2 km".
 */
export function formatTransitDistance(meters: number): string {
  if (meters < 1000) {
    return `~${Math.round(meters)} m`;
  }
  const km = (meters / 1000).toFixed(1);
  return `~${km.endsWith(".0") ? km.slice(0, -2) : km} km`;
}

/**
 * Formats walking time with a tilde prefix, e.g. "~5 min walk".
 */
export function formatWalkingMinutes(minutes: number): string {
  return `~${minutes} min walk`;
}

/**
 * Estimates cab driving time and distance for "How far from me?".
 * Returns e.g. "15 km away · ~42 min by cab".
 */
export function formatCabEstimate(straightMeters: number): string {
  const roadKm = Math.max(0.5, Math.round((straightMeters * 1.25) / 100) / 10);
  // Estimate ~25 km/h urban traffic speed + 5 min dispatch/pickup buffer
  const minutes = Math.max(5, Math.round(roadKm * 2.5 + 5));
  const kmText = roadKm < 1 ? `${Math.round(straightMeters)} m` : `${roadKm % 1 === 0 ? roadKm.toFixed(0) : roadKm.toFixed(1)} km`;
  return `${kmText} away · ~${minutes} min by cab`;
}
