"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Point = { latitude: number; longitude: number };
export default function LocationMap({
  point,
  onPick,
  readOnly = false,
}: {
  point: Point | null;
  onPick: (point: Point) => void;
  readOnly?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const callback = useRef(onPick);
  const initialPoint = useRef(point);
  const editable = useRef(!readOnly);
  const [error, setError] = useState("");
  useEffect(() => {
    callback.current = onPick;
  }, [onPick]);
  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl")
      .then(({ Map, Marker, NavigationControl, setWorkerUrl }) => {
        if (cancelled || !container.current) return;
        try {
          setWorkerUrl(
            new URL(
              "maplibre-gl/dist/maplibre-gl-worker.mjs",
              import.meta.url,
            ).toString(),
          );
          const instance = new Map({
            container: container.current,
            center: initialPoint.current
              ? [initialPoint.current.longitude, initialPoint.current.latitude]
              : [78.9629, 20.5937],
            zoom: initialPoint.current ? 13 : 4,
            maxZoom: 18,
            cooperativeGestures: true,
            attributionControl: { compact: false },
            style: {
              version: 8,
              sources: {
                streets: {
                  type: "raster",
                  tiles: [
                    process.env.NEXT_PUBLIC_MAP_TILE_URL ||
                      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                  ],
                  tileSize: 256,
                  attribution:
                    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
                    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
                },
              },
              layers: [{ id: "streets", type: "raster", source: "streets" }],
            },
          });
          map.current = instance;
          instance.addControl(
            new NavigationControl({ showCompass: false }),
            "top-right",
          );
          const pin = new Marker({
            color: "var(--accent)",
            draggable: editable.current,
          });
          marker.current = pin;
          pin
            .getElement()
            .setAttribute(
              "aria-label",
              "Selected location pin. Use arrow keys to adjust.",
            );
          pin.on("dragend", () => {
            const value = pin.getLngLat();
            callback.current({ latitude: value.lat, longitude: value.lng });
          });
          instance.on("click", (event) => {
            if (!editable.current) return;
            pin.setLngLat(event.lngLat).addTo(instance);
            callback.current({
              latitude: event.lngLat.lat,
              longitude: event.lngLat.lng,
            });
          });
          instance.on("error", () =>
            setError(
              "Some map tiles could not load. You can still search or enter your city manually.",
            ),
          );
          instance.on("load", () =>
            container.current?.dispatchEvent(new Event("map-ready")),
          );
        } catch {
          setError(
            "The interactive map is unavailable on this browser. Search for a place or enter your city below.",
          );
        }
      })
      .catch(() =>
        setError("Could not load the map. Use city search or manual entry."),
      );
    return () => {
      cancelled = true;
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);
  useEffect(() => {
    const update = () => {
      if (point && map.current && marker.current) {
        marker.current
          .setLngLat([point.longitude, point.latitude])
          .addTo(map.current);
        map.current.flyTo({
          center: [point.longitude, point.latitude],
          zoom: Math.max(map.current.getZoom(), 13),
          duration: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : 500,
        });
      } else marker.current?.remove();
    };
    update();
    const element = container.current;
    element?.addEventListener("map-ready", update);
    return () => element?.removeEventListener("map-ready", update);
  }, [point]);
  return (
    <div className="r-map-wrap">
      <div
        ref={container}
        className="r-map"
        aria-label="Interactive location map"
        role="region"
      />
      {error && (
        <p className="r-map-error" role="status">
          {error}
        </p>
      )}
      <span className="r-map-hint">
        {readOnly
          ? "Venue entrance. Use + / − to zoom."
          : "Tap the map or drag the pin. Use + / − to zoom."}
      </span>
    </div>
  );
}
