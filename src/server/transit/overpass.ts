import { haversineDistance, computeWalkingDistance, computeWalkingMinutes } from "@/lib/transit/geo";
import { matchMetroLine } from "@/lib/transit/lines";

export type NearbyStation = {
  name: string;
  lineName: string;
  lineColor: string;
  distanceMeters: number;
  walkMinutes: number;
  latitude: number;
  longitude: number;
};

// Curated stations for instant response and offline/resilient fallback across key Indian metros
const CURATED_METRO_STATIONS: Array<{
  name: string;
  lineName: string;
  lineColor?: string;
  city: string;
  lat: number;
  lng: number;
}> = [
  // Delhi Metro
  { name: "Saket", lineName: "Yellow Line", lineColor: "#FFD700", city: "Delhi", lat: 28.5209, lng: 77.2014 },
  { name: "Malviya Nagar", lineName: "Yellow Line", lineColor: "#FFD700", city: "Delhi", lat: 28.5282, lng: 77.2062 },
  { name: "Hauz Khas", lineName: "Yellow Line / Magenta Line", lineColor: "#FFD700", city: "Delhi", lat: 28.5432, lng: 77.2064 },
  { name: "Qutab Minar", lineName: "Yellow Line", lineColor: "#FFD700", city: "Delhi", lat: 28.5132, lng: 77.1861 },
  { name: "Rajiv Chowk", lineName: "Yellow Line / Blue Line", lineColor: "#0066CC", city: "Delhi", lat: 28.6328, lng: 77.2195 },
  { name: "Mandi House", lineName: "Blue Line / Violet Line", lineColor: "#0066CC", city: "Delhi", lat: 28.6258, lng: 77.2343 },
  { name: "Barakhamba Road", lineName: "Blue Line", lineColor: "#0066CC", city: "Delhi", lat: 28.6304, lng: 77.2274 },
  { name: "Patel Chowk", lineName: "Yellow Line", lineColor: "#FFD700", city: "Delhi", lat: 28.6231, lng: 77.2139 },
  { name: "Central Secretariat", lineName: "Yellow Line / Violet Line", lineColor: "#FFD700", city: "Delhi", lat: 28.6148, lng: 77.2119 },
  { name: "Khan Market", lineName: "Violet Line", lineColor: "#7B1FA2", city: "Delhi", lat: 28.6006, lng: 77.2272 },
  { name: "JLN Stadium", lineName: "Violet Line", lineColor: "#7B1FA2", city: "Delhi", lat: 28.5898, lng: 77.2349 },
  { name: "Lajpat Nagar", lineName: "Pink Line / Violet Line", lineColor: "#EC407A", city: "Delhi", lat: 28.5707, lng: 77.2374 },
  { name: "Nehru Place", lineName: "Violet Line", lineColor: "#7B1FA2", city: "Delhi", lat: 28.5516, lng: 77.2524 },
  { name: "Kalkaji Mandir", lineName: "Violet Line / Magenta Line", lineColor: "#7B1FA2", city: "Delhi", lat: 28.5498, lng: 77.2588 },
  { name: "Botanical Garden", lineName: "Blue Line / Magenta Line", lineColor: "#0066CC", city: "Noida", lat: 28.5642, lng: 77.3343 },
  { name: "Sector 18 Noida", lineName: "Blue Line", lineColor: "#0066CC", city: "Noida", lat: 28.5708, lng: 77.3261 },
  { name: "MG Road Gurgaon", lineName: "Yellow Line", lineColor: "#FFD700", city: "Gurugram", lat: 28.4800, lng: 77.0803 },
  { name: "Cyber City", lineName: "Rapid Metro", lineColor: "#00BCD4", city: "Gurugram", lat: 28.4950, lng: 77.0890 },
  { name: "Sikanderpur", lineName: "Yellow Line / Rapid Metro", lineColor: "#FFD700", city: "Gurugram", lat: 28.4819, lng: 77.0927 },
  { name: "IFFCO Chowk", lineName: "Yellow Line", lineColor: "#FFD700", city: "Gurugram", lat: 28.4720, lng: 77.0725 },
  { name: "Millennium City Centre", lineName: "Yellow Line", lineColor: "#FFD700", city: "Gurugram", lat: 28.4593, lng: 77.0726 },
  { name: "Kashmere Gate", lineName: "Red / Yellow / Violet Line", lineColor: "#D32F2F", city: "Delhi", lat: 28.6675, lng: 77.2285 },
  { name: "Chandni Chowk", lineName: "Yellow Line", lineColor: "#FFD700", city: "Delhi", lat: 28.6578, lng: 77.2301 },
  { name: "Chawri Bazar", lineName: "Yellow Line", lineColor: "#FFD700", city: "Delhi", lat: 28.6493, lng: 77.2263 },
  { name: "New Delhi", lineName: "Yellow / Airport Express", lineColor: "#FF9800", city: "Delhi", lat: 28.6431, lng: 77.2223 },
  { name: "INA", lineName: "Yellow / Pink Line", lineColor: "#EC407A", city: "Delhi", lat: 28.5744, lng: 77.2098 },
  { name: "AIIMS", lineName: "Yellow Line", lineColor: "#FFD700", city: "Delhi", lat: 28.5684, lng: 77.2078 },
  { name: "Green Park", lineName: "Yellow Line", lineColor: "#FFD700", city: "Delhi", lat: 28.5587, lng: 77.2069 },

  // Mumbai Metro
  { name: "Ghatkopar", lineName: "Line 1 (Blue Line)", lineColor: "#0066CC", city: "Mumbai", lat: 19.0864, lng: 72.9082 },
  { name: "Andheri", lineName: "Line 1 (Blue Line)", lineColor: "#0066CC", city: "Mumbai", lat: 19.1197, lng: 72.8464 },
  { name: "Versova", lineName: "Line 1 (Blue Line)", lineColor: "#0066CC", city: "Mumbai", lat: 19.1315, lng: 72.8173 },
  { name: "Saki Naka", lineName: "Line 1 (Blue Line)", lineColor: "#0066CC", city: "Mumbai", lat: 19.1025, lng: 72.8879 },
  { name: "Marol Naka", lineName: "Line 1 / Line 3", lineColor: "#0066CC", city: "Mumbai", lat: 19.1098, lng: 72.8797 },
  { name: "WEH (Western Express Highway)", lineName: "Line 1 (Blue Line)", lineColor: "#0066CC", city: "Mumbai", lat: 19.1158, lng: 72.8566 },
  { name: "DN Nagar", lineName: "Line 1 / Line 2A", lineColor: "#0066CC", city: "Mumbai", lat: 19.1245, lng: 72.8298 },
  { name: "Gundavali", lineName: "Line 7 (Red Line)", lineColor: "#D32F2F", city: "Mumbai", lat: 19.1152, lng: 72.8569 },
  { name: "Aarey", lineName: "Line 3 (Aqua Line)", lineColor: "#00BCD4", city: "Mumbai", lat: 19.1489, lng: 72.8682 },
  { name: "BKC", lineName: "Line 3 (Aqua Line)", lineColor: "#00BCD4", city: "Mumbai", lat: 19.0657, lng: 72.8683 },
  { name: "Dadar", lineName: "Line 3 (Aqua Line)", lineColor: "#00BCD4", city: "Mumbai", lat: 19.0178, lng: 72.8478 },

  // Bengaluru Namma Metro
  { name: "MG Road", lineName: "Purple Line", lineColor: "#7B1FA2", city: "Bengaluru", lat: 12.9756, lng: 77.6068 },
  { name: "Indiranagar", lineName: "Purple Line", lineColor: "#7B1FA2", city: "Bengaluru", lat: 12.9783, lng: 77.6387 },
  { name: "Cubbon Park", lineName: "Purple Line", lineColor: "#7B1FA2", city: "Bengaluru", lat: 12.9810, lng: 77.5976 },
  { name: "Majestic (Nadaprabhu Kempegowda)", lineName: "Purple Line / Green Line", lineColor: "#2E7D32", city: "Bengaluru", lat: 12.9757, lng: 77.5728 },
  { name: "Trinity", lineName: "Purple Line", lineColor: "#7B1FA2", city: "Bengaluru", lat: 12.9729, lng: 77.6171 },
  { name: "Halasuru", lineName: "Purple Line", lineColor: "#7B1FA2", city: "Bengaluru", lat: 12.9760, lng: 77.6264 },
  { name: "Baiyappanahalli", lineName: "Purple Line", lineColor: "#7B1FA2", city: "Bengaluru", lat: 12.9912, lng: 77.6521 },
  { name: "Whitefield (Kadugodi)", lineName: "Purple Line", lineColor: "#7B1FA2", city: "Bengaluru", lat: 12.9961, lng: 77.7607 },
  { name: "Jayanagar", lineName: "Green Line", lineColor: "#2E7D32", city: "Bengaluru", lat: 12.9298, lng: 77.5802 },
  { name: "South End Circle", lineName: "Green Line", lineColor: "#2E7D32", city: "Bengaluru", lat: 12.9382, lng: 77.5794 },
  { name: "Lalbagh", lineName: "Green Line", lineColor: "#2E7D32", city: "Bengaluru", lat: 12.9465, lng: 77.5800 },
  { name: "National College", lineName: "Green Line", lineColor: "#2E7D32", city: "Bengaluru", lat: 12.9507, lng: 77.5739 },
  { name: "Yeshwanthpur", lineName: "Green Line", lineColor: "#2E7D32", city: "Bengaluru", lat: 13.0232, lng: 77.5499 },

  // Hyderabad Metro
  { name: "HITEC City", lineName: "Blue Line", lineColor: "#0066CC", city: "Hyderabad", lat: 17.4475, lng: 78.3762 },
  { name: "Raidurg", lineName: "Blue Line", lineColor: "#0066CC", city: "Hyderabad", lat: 17.4395, lng: 78.3768 },
  { name: "Durgam Cheruvu", lineName: "Blue Line", lineColor: "#0066CC", city: "Hyderabad", lat: 17.4428, lng: 78.3872 },
  { name: "Madhapur", lineName: "Blue Line", lineColor: "#0066CC", city: "Hyderabad", lat: 17.4385, lng: 78.3971 },
  { name: "Jubilee Hills Check Post", lineName: "Blue Line", lineColor: "#0066CC", city: "Hyderabad", lat: 17.4285, lng: 78.4116 },
  { name: "Ameerpet", lineName: "Red / Blue Line", lineColor: "#D32F2F", city: "Hyderabad", lat: 17.4348, lng: 78.4485 },
  { name: "Begumpet", lineName: "Blue Line", lineColor: "#0066CC", city: "Hyderabad", lat: 17.4397, lng: 78.4627 },
  { name: "Miyapur", lineName: "Red Line", lineColor: "#D32F2F", city: "Hyderabad", lat: 17.4967, lng: 78.3614 },
  { name: "KPHB Colony", lineName: "Red Line", lineColor: "#D32F2F", city: "Hyderabad", lat: 17.4929, lng: 78.3995 },
  { name: "MGBS", lineName: "Red / Green Line", lineColor: "#D32F2F", city: "Hyderabad", lat: 17.3789, lng: 78.4812 },

  // Chennai Metro
  { name: "Chennai Central", lineName: "Blue / Green Line", lineColor: "#0066CC", city: "Chennai", lat: 13.0827, lng: 80.2755 },
  { name: "Government Estate", lineName: "Blue Line", lineColor: "#0066CC", city: "Chennai", lat: 13.0694, lng: 80.2731 },
  { name: "LIC", lineName: "Blue Line", lineColor: "#0066CC", city: "Chennai", lat: 13.0635, lng: 80.2673 },
  { name: "Thousand Lights", lineName: "Blue Line", lineColor: "#0066CC", city: "Chennai", lat: 13.0569, lng: 80.2559 },
  { name: "AG-DMS", lineName: "Blue Line", lineColor: "#0066CC", city: "Chennai", lat: 13.0458, lng: 80.2479 },
  { name: "Teynampet", lineName: "Blue Line", lineColor: "#0066CC", city: "Chennai", lat: 13.0399, lng: 80.2464 },
  { name: "Nandanam", lineName: "Blue Line", lineColor: "#0066CC", city: "Chennai", lat: 13.0315, lng: 80.2415 },
  { name: "Guindy", lineName: "Blue Line", lineColor: "#0066CC", city: "Chennai", lat: 13.0084, lng: 80.2132 },
  { name: "Airport", lineName: "Blue Line", lineColor: "#0066CC", city: "Chennai", lat: 12.9814, lng: 80.1651 },
  { name: "Koyambedu", lineName: "Green Line", lineColor: "#2E7D32", city: "Chennai", lat: 13.0732, lng: 80.1947 },

  // Kolkata Metro
  { name: "Park Street", lineName: "Blue Line (Line 1)", lineColor: "#0066CC", city: "Kolkata", lat: 22.5516, lng: 88.3517 },
  { name: "Esplanade", lineName: "Blue / Green Line", lineColor: "#0066CC", city: "Kolkata", lat: 22.5645, lng: 88.3514 },
  { name: "Maidan", lineName: "Blue Line (Line 1)", lineColor: "#0066CC", city: "Kolkata", lat: 22.5445, lng: 88.3496 },
  { name: "Rabindra Sadan", lineName: "Blue Line (Line 1)", lineColor: "#0066CC", city: "Kolkata", lat: 22.5385, lng: 88.3467 },
  { name: "Salt Lake Sector V", lineName: "Green Line (Line 2)", lineColor: "#2E7D32", city: "Kolkata", lat: 22.5802, lng: 88.4285 },
  { name: "Howrah", lineName: "Green Line (Line 2)", lineColor: "#2E7D32", city: "Kolkata", lat: 22.5839, lng: 88.3432 },
  { name: "Dum Dum", lineName: "Blue Line (Line 1)", lineColor: "#0066CC", city: "Kolkata", lat: 22.6219, lng: 88.3931 },

  // Pune Metro
  { name: "District Court", lineName: "Purple / Aqua Line", lineColor: "#7B1FA2", city: "Pune", lat: 18.5287, lng: 73.8567 },
  { name: "Shivajinagar", lineName: "Purple Line (Line 1)", lineColor: "#7B1FA2", city: "Pune", lat: 18.5314, lng: 73.8523 },
  { name: "Civil Court", lineName: "Purple / Aqua Line", lineColor: "#7B1FA2", city: "Pune", lat: 18.5262, lng: 73.8580 },
  { name: "Pune Railway Station", lineName: "Aqua Line (Line 2)", lineColor: "#00BCD4", city: "Pune", lat: 18.5298, lng: 73.8744 },
  { name: "Ruby Hall Clinic", lineName: "Aqua Line (Line 2)", lineColor: "#00BCD4", city: "Pune", lat: 18.5332, lng: 73.8821 },
  { name: "Vanaz", lineName: "Aqua Line (Line 2)", lineColor: "#00BCD4", city: "Pune", lat: 18.5029, lng: 73.8052 },
  { name: "PCMC", lineName: "Purple Line (Line 1)", lineColor: "#7B1FA2", city: "Pune", lat: 18.6298, lng: 73.8118 },
];

/**
 * Normalizes station names by stripping redundant words like "Metro Station", "Metro", etc.
 */
function cleanStationName(rawName: string): string {
  return rawName
    .replace(/\s*(metro\s*station|subway\s*station|station|metro)\s*$/i, "")
    .trim();
}

/**
 * Searches OpenStreetMap Overpass API for subway / light_rail stations within 2.5 km.
 */
async function fetchOverpassStations(lat: number, lng: number): Promise<NearbyStation[]> {
  const query = `[out:json][timeout:8];
(
  node["railway"="station"]["station"~"subway|light_rail"](around:2500,${lat},${lng});
  node["railway"="station"]["subway"="yes"](around:2500,${lat},${lng});
  node["station"="subway"](around:2500,${lat},${lng});
  way["railway"="station"]["station"="subway"](around:2500,${lat},${lng});
);
out center tags;`;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
  ];

  let rawData: unknown = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(7000),
      });
      if (response.ok) {
        rawData = await response.json();
        break;
      }
    } catch {
      // Try next endpoint
    }
  }

  if (!rawData || typeof rawData !== "object" || !("elements" in rawData)) {
    return [];
  }

  const elements =
    (
      rawData as {
        elements?: Array<{
          lat?: number;
          lon?: number;
          center?: { lat?: number; lon?: number };
          tags?: Record<string, string>;
        }>;
      }
    ).elements || [];
  const results: NearbyStation[] = [];
  const seenNames = new Set<string>();

  for (const el of elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (typeof elLat !== "number" || typeof elLng !== "number") continue;

    const tags = el.tags || {};
    const rawName = tags.name || tags["name:en"] || tags.operator || "";
    if (!rawName) continue;

    const cleanName = cleanStationName(rawName);
    const lowerKey = cleanName.toLowerCase();
    if (seenNames.has(lowerKey)) continue;
    seenNames.add(lowerKey);

    const straightM = haversineDistance(lat, lng, elLat, elLng);
    if (straightM > 2500) continue;

    const walkingM = computeWalkingDistance(straightM);
    const walkMin = computeWalkingMinutes(walkingM);

    const lineHint = tags.line || tags.network || tags.route_ref || tags.colour || tags.color || "";
    const colorHint = tags.colour || tags.color;
    const matched = matchMetroLine(cleanName, lineHint, colorHint);

    results.push({
      name: cleanName,
      lineName: matched.lineName,
      lineColor: matched.color,
      distanceMeters: walkingM,
      walkMinutes: walkMin,
      latitude: elLat,
      longitude: elLng,
    });
  }

  return results;
}

/**
 * Searches Google Places API if key exists in env.
 */
async function fetchGooglePlacesStations(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<NearbyStation[]> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", "2500");
    url.searchParams.set("type", "subway_station");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    const results: NearbyStation[] = [];
    const seen = new Set<string>();

    for (const place of data.results) {
      const pLat = place.geometry?.location?.lat;
      const pLng = place.geometry?.location?.lng;
      if (typeof pLat !== "number" || typeof pLng !== "number") continue;

      const cleanName = cleanStationName(place.name || "");
      if (!cleanName) continue;
      const key = cleanName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const straightM = haversineDistance(lat, lng, pLat, pLng);
      if (straightM > 2500) continue;

      const walkingM = computeWalkingDistance(straightM);
      const walkMin = computeWalkingMinutes(walkingM);
      const matched = matchMetroLine(cleanName);

      results.push({
        name: cleanName,
        lineName: matched.lineName,
        lineColor: matched.color,
        distanceMeters: walkingM,
        walkMinutes: walkMin,
        latitude: pLat,
        longitude: pLng,
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Finds curated stations within 2.5 km (resilient fallback).
 */
function findCuratedStations(lat: number, lng: number): NearbyStation[] {
  const results: NearbyStation[] = [];

  for (const st of CURATED_METRO_STATIONS) {
    const straightM = haversineDistance(lat, lng, st.lat, st.lng);
    if (straightM <= 2500) {
      const walkingM = computeWalkingDistance(straightM);
      const walkMin = computeWalkingMinutes(walkingM);
      const matched = matchMetroLine(st.name, st.lineName, st.lineColor);

      results.push({
        name: st.name,
        lineName: matched.lineName,
        lineColor: matched.color,
        distanceMeters: walkingM,
        walkMinutes: walkMin,
        latitude: st.lat,
        longitude: st.lng,
      });
    }
  }

  return results;
}

/**
 * Finds top 3 nearest metro/light rail stations within 2.5 km of coordinates.
 * Priority:
 * 1. Google Places (if key exists)
 * 2. OpenStreetMap Overpass API
 * 3. Curated Indian metro stations fallback
 */
export async function getNearestStations(
  lat: number,
  lng: number,
  maxResults = 3,
): Promise<NearbyStation[]> {
  const stationsMap = new Map<string, NearbyStation>();

  // 1. Check Google Places if available
  const googleKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    const googleStations = await fetchGooglePlacesStations(lat, lng, googleKey);
    for (const s of googleStations) {
      stationsMap.set(s.name.toLowerCase(), s);
    }
  }

  // 2. If fewer than maxResults, query Overpass API
  if (stationsMap.size < maxResults) {
    const overpassStations = await fetchOverpassStations(lat, lng);
    for (const s of overpassStations) {
      if (!stationsMap.has(s.name.toLowerCase())) {
        stationsMap.set(s.name.toLowerCase(), s);
      }
    }
  }

  // 3. Fall back to curated stations
  if (stationsMap.size < maxResults) {
    const curated = findCuratedStations(lat, lng);
    for (const s of curated) {
      if (!stationsMap.has(s.name.toLowerCase())) {
        stationsMap.set(s.name.toLowerCase(), s);
      }
    }
  }

  // Sort by distance ascending and return top N
  return Array.from(stationsMap.values())
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, maxResults);
}
