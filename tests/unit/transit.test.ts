import { describe, expect, it } from "vitest";
import {
  haversineDistance,
  computeWalkingDistance,
  computeWalkingMinutes,
  formatTransitDistance,
  formatWalkingMinutes,
  formatCabEstimate,
} from "@/lib/transit/geo";
import {
  buildGoogleMapsTransitLink,
  buildUberLink,
  buildOlaLink,
} from "@/lib/transit/links";
import { matchMetroLine } from "@/lib/transit/lines";

describe("Transit Geo Calculations", () => {
  it("calculates accurate haversine straight-line distance", () => {
    // Distance between Saket Metro (28.5209, 77.2014) and nearby point (28.5235, 77.2035) ~360m
    const dist = haversineDistance(28.5209, 77.2014, 28.5235, 77.2035);
    expect(dist).toBeGreaterThan(300);
    expect(dist).toBeLessThan(450);
  });

  it("computes walking distance as ~1.3x straight-line distance", () => {
    const straight = 308;
    const walking = computeWalkingDistance(straight);
    expect(walking).toBe(Math.round(308 * 1.3));
    expect(walking).toBe(400);
  });

  it("computes walking minutes at ~80m per minute", () => {
    expect(computeWalkingMinutes(400)).toBe(5);
    expect(computeWalkingMinutes(80)).toBe(1);
    expect(computeWalkingMinutes(30)).toBe(1); // min 1 minute
    expect(computeWalkingMinutes(1600)).toBe(20);
  });

  it("formats transit distance with tilde prefix", () => {
    expect(formatTransitDistance(400)).toBe("~400 m");
    expect(formatTransitDistance(950)).toBe("~950 m");
    expect(formatTransitDistance(1200)).toBe("~1.2 km");
    expect(formatTransitDistance(2000)).toBe("~2 km");
  });

  it("formats walking minutes with tilde prefix", () => {
    expect(formatWalkingMinutes(5)).toBe("~5 min walk");
    expect(formatWalkingMinutes(12)).toBe("~12 min walk");
  });

  it("formats cab estimate accurately", () => {
    // 12,000 straight meters -> ~15.6 km driving -> ~35 min cab
    const estimate = formatCabEstimate(12000);
    expect(estimate).toContain("km away");
    expect(estimate).toContain("min by cab");
  });
});

describe("Transit Link Builders & URL Encoding", () => {
  it("builds valid Google Maps transit directions link with encoded coords", () => {
    const url = buildGoogleMapsTransitLink({ lat: 28.5209, lng: 77.2014 });
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=28.5209,77.2014&travelmode=transit",
    );
  });

  it("builds Uber web and deep links with encoded parameters", () => {
    const { webUrl, appUrl } = buildUberLink({
      lat: 28.5209,
      lng: 77.2014,
      venueName: "Select CITYWALK & Saket District",
      address: "A-3, District Centre, Saket, New Delhi",
    });

    expect(webUrl).toContain("https://m.uber.com/ul/?");
    expect(webUrl).toContain("action=setPickup");
    expect(webUrl).toContain("pickup=my_location");
    expect(webUrl).toContain("dropoff%5Blatitude%5D=28.5209");
    expect(webUrl).toContain("dropoff%5Blongitude%5D=77.2014");
    expect(webUrl).toContain("dropoff%5Bnickname%5D=Select+CITYWALK+%26+Saket+District");
    expect(appUrl.startsWith("uber://?")).toBe(true);
  });

  it("builds Ola Cabs link with book.olacabs.com drop parameters", () => {
    const { webUrl, appUrl } = buildOlaLink({
      lat: 28.5209,
      lng: 77.2014,
      venueName: "Select CITYWALK",
      address: "Saket District Centre",
    });

    expect(webUrl).toContain("https://book.olacabs.com/?");
    expect(webUrl).toContain("drop_lat=28.5209");
    expect(webUrl).toContain("drop_lng=77.2014");
    expect(webUrl).toContain("drop_name=Select+CITYWALK");
    expect(appUrl).toContain("olacabs://app/launch?");
  });

  it("falls back safely for invalid coordinates in buildOlaLink", () => {
    const { webUrl, appUrl } = buildOlaLink({
      lat: NaN,
      lng: 200,
    });
    expect(webUrl).toBe("https://book.olacabs.com/");
    expect(appUrl).toBe("olacabs://");
  });
});

describe("Metro Line Color & Fuzzy Matcher", () => {
  it("prioritizes valid OSM color tag if provided", () => {
    const res = matchMetroLine("Saket", "Yellow Line", "#FFD700");
    expect(res.color).toBe("#FFD700");
    expect(res.lineName).toBe("Yellow Line");
  });

  it("matches Delhi Yellow Line correctly", () => {
    const res = matchMetroLine("Saket");
    expect(res.lineName).toBe("Yellow Line");
    expect(res.color).toBe("#FFD700");
  });

  it("matches Bangalore Purple Line correctly", () => {
    const res = matchMetroLine("MG Road", "Namma Metro Purple Line");
    expect(res.lineName).toBe("Purple Line");
    expect(res.color).toBe("#7B1FA2");
  });

  it("matches Mumbai Metro Line 1 correctly", () => {
    const res = matchMetroLine("Ghatkopar", "Line 1");
    expect(res.lineName).toBe("Line 1 (Blue Line)");
    expect(res.color).toBe("#0066CC");
  });

  it("falls back to neutral grey for unknown lines", () => {
    const res = matchMetroLine("Imaginary Station", "Unknown Shuttle");
    expect(res.color).toBe("#71717A");
    expect(res.lineName).toBe("Unknown Shuttle");
  });
});
