/**
 * Direction & ride service URL builders for event venues.
 */

export type TransitDestination = {
  lat: number;
  lng: number;
  venueName?: string | null;
  address?: string | null;
};

/**
 * Builds the official Google Maps transit directions link.
 * Format: https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=transit
 */
export function buildGoogleMapsTransitLink({ lat, lng }: TransitDestination): string {
  const destination = `${encodeURIComponent(String(lat))},${encodeURIComponent(String(lng))}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=transit`;
}

/**
 * Builds Uber web and deep-app links with pickup set to user's location and dropoff pre-filled.
 */
export function buildUberLink({
  lat,
  lng,
  venueName,
  address,
}: TransitDestination): { webUrl: string; appUrl: string } {
  const nickname = (venueName || "Venue").trim();
  const formattedAddress = (address || venueName || "").trim();

  const query = new URLSearchParams({
    action: "setPickup",
    pickup: "my_location",
    "dropoff[latitude]": String(lat),
    "dropoff[longitude]": String(lng),
    "dropoff[nickname]": nickname,
    "dropoff[formatted_address]": formattedAddress,
  }).toString();

  return {
    webUrl: `https://m.uber.com/ul/?${query}`,
    appUrl: `uber://?${query}`,
  };
}

/**
 * Builds Ola Cabs web and deep-app links.
 * Isolated in ONE function so URL params can be swapped or updated easily.
 * Supports current book.olacabs.com drop_lat/drop_lng and falls back gracefully.
 */
export function buildOlaLink({
  lat,
  lng,
  venueName,
  address,
}: TransitDestination): { webUrl: string; appUrl: string } {
  const dropName = (venueName || "Venue").trim();
  const dropAddress = (address || venueName || "").trim();

  // Validate coordinates before building specific query
  const hasValidCoords =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  if (!hasValidCoords) {
    return {
      webUrl: "https://book.olacabs.com/",
      appUrl: "olacabs://",
    };
  }

  const webParams = new URLSearchParams({
    drop_lat: String(lat),
    drop_lng: String(lng),
    ...(dropName ? { drop_name: dropName } : {}),
    ...(dropAddress ? { drop_address: dropAddress } : {}),
  }).toString();

  const appParams = new URLSearchParams({
    landing_page: "bk",
    drop_lat: String(lat),
    drop_lng: String(lng),
    ...(dropName ? { drop_name: dropName } : {}),
    ...(dropAddress ? { drop_address: dropAddress } : {}),
  }).toString();

  return {
    webUrl: `https://book.olacabs.com/?${webParams}`,
    appUrl: `olacabs://app/launch?${appParams}`,
  };
}
