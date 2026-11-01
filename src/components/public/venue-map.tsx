"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import "./venue-transit.css";

type Station = { name: string; latitude: number; longitude: number; lineColor?: string };

export function VenueMap({
  latitude,
  longitude,
  venueName = "Event venue",
  area,
  address,
  station,
}: {
  latitude: number;
  longitude: number;
  venueName?: string;
  area?: string;
  address?: string;
  station?: Station | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const node = root.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "180px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !mapContainer.current || map.current) return;
    let cancelled = false;
    let didLoad = false;
    let marker: import("maplibre-gl").Marker | undefined;
    let stationMarker: import("maplibre-gl").Marker | undefined;
    async function initialize() {
      try {
        const { Map, Marker, setWorkerUrl } = await import("maplibre-gl");
        if (cancelled || !mapContainer.current) return;
        setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
        const dark = document.documentElement.dataset.marketingTheme !== "light";
        const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || `https://basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}.png`;
        const attribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>';
        const instance = new Map({
          container: mapContainer.current,
          center: [longitude, latitude],
          zoom: 15,
          minZoom: 3,
          maxZoom: 18,
          cooperativeGestures: true,
          attributionControl: { compact: true, customAttribution: attribution },
          style: { version: 8, sources: { raunakTiles: { type: "raster", tiles: [tileUrl], tileSize: 256, attribution } }, layers: [{ id: "raunakTiles", type: "raster", source: "raunakTiles" }] },
        });
        map.current = instance;
        mapContainer.current.classList.toggle(
          "r-map-osm-dark",
          dark && (process.env.NEXT_PUBLIC_MAP_TILE_URL || "").includes("tile.openstreetmap.org"),
        );
        instance.on("load", () => { didLoad = true; if (!cancelled) setLoaded(true); });
        instance.on("error", () => { if (!didLoad) setFailed(true); });
        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "transit-map-marker";
        pin.setAttribute("aria-label", `Venue: ${venueName}`);
        const label = document.createElement("span");
        label.className = "transit-map-popup";
        label.textContent = venueName;
        pin.append(label);
        marker = new Marker({ element: pin, anchor: "center" }).setLngLat([longitude, latitude]).addTo(instance);
        if (station) {
          const stationPin = document.createElement("span");
          stationPin.className = "transit-station-marker";
          stationPin.setAttribute("aria-label", `${station.name} Metro station`);
          stationPin.style.setProperty("--station-color", station.lineColor || "#d8b537");
          stationMarker = new Marker({ element: stationPin, anchor: "center" }).setLngLat([station.longitude, station.latitude]).addTo(instance);
          instance.fitBounds([[Math.min(longitude, station.longitude), Math.min(latitude, station.latitude)], [Math.max(longitude, station.longitude), Math.max(latitude, station.latitude)]], { padding: 48, maxZoom: 16, duration: 0 });
        }
        instance.getCanvas().setAttribute("tabindex", "0");
        instance.getCanvas().setAttribute("role", "region");
        instance.getCanvas().setAttribute("aria-label", `Map showing ${venueName}${area ? ` in ${area}` : ""}`);
        instance.getCanvas().addEventListener("keydown", (event) => {
          const step = event.shiftKey ? 120 : 60;
          if (event.key === "ArrowLeft") instance.panBy([-step, 0]);
          else if (event.key === "ArrowRight") instance.panBy([step, 0]);
          else if (event.key === "ArrowUp") instance.panBy([0, step]);
          else if (event.key === "ArrowDown") instance.panBy([0, -step]);
          else if (event.key === "+" || event.key === "=") instance.zoomIn();
          else if (event.key === "-") instance.zoomOut();
          else return;
          event.preventDefault();
        });
        const themeObserver = new MutationObserver(() => {
          const isDark = document.documentElement.dataset.marketingTheme !== "light";
          const nextUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || `https://basemaps.cartocdn.com/${isDark ? "dark_all" : "light_all"}/{z}/{x}/{y}.png`;
          mapContainer.current?.classList.toggle(
            "r-map-osm-dark",
            isDark && (process.env.NEXT_PUBLIC_MAP_TILE_URL || "").includes("tile.openstreetmap.org"),
          );
          if (!process.env.NEXT_PUBLIC_MAP_TILE_URL) {
            instance.setStyle({ version: 8, sources: { raunakTiles: { type: "raster", tiles: [nextUrl], tileSize: 256, attribution } }, layers: [{ id: "raunakTiles", type: "raster", source: "raunakTiles" }] });
          }
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-marketing-theme"] });
        instance.once("remove", () => themeObserver.disconnect());
      } catch {
        setFailed(true);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      marker?.remove();
      stationMarker?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, [visible, latitude, longitude, venueName, area, station]);

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  return (
    <div className="event-lazy-map" ref={root}>
      {!visible ? (
        <button className="event-map-load" type="button" onClick={() => setVisible(true)} aria-label={`Load map showing ${venueName}`}>
          <strong>{venueName}</strong><span>Map preview · Load interactive map</span>
        </button>
      ) : failed ? (
        <div className="event-map-fallback"><strong>Map preview unavailable</strong><p>{address || venueName}</p><a className="transit-btn transit-btn-primary" href={mapUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</a></div>
      ) : (
        <>
          <div className="r-map-wrap"><div ref={mapContainer} className="r-map" /></div>
          <div className="transit-map-zoom" aria-label="Map zoom controls"><button type="button" aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus size={18}/></button><button type="button" aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus size={18}/></button></div>
          {!loaded && <div className="transit-map-loading" role="status">Loading map…</div>}
        </>
      )}
    </div>
  );
}
