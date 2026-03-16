"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapLeg {
  polyline: [number, number][];
  style: "solid-orange" | "dashed-orange" | "dashed-rider";
  color?: string; // override for rider-specific colors
}

export interface MapMarker {
  position: [number, number];
  type:
    | "start"
    | "waypoint"
    | "routeEnd"
    | "destination"
    | "fuel"
    | "medical"
    | "cafe"
    | "rider";
  label?: string;
  color?: string;
}

export interface MapProps {
  legs: MapLeg[];
  markers?: MapMarker[];
  fitBounds?: boolean;
}

const LEG_STYLES: Record<
  MapLeg["style"],
  (color?: string) => L.PathOptions
> = {
  "solid-orange": () => ({
    color: "#FF6B2B",
    weight: 3,
    opacity: 0.9,
  }),
  "dashed-orange": () => ({
    color: "#FF6B2B",
    weight: 3,
    opacity: 0.6,
    dashArray: "8, 8",
  }),
  "dashed-rider": (color?: string) => ({
    color: color || "#3B82F6",
    weight: 2,
    opacity: 0.6,
    dashArray: "6, 8",
  }),
};

function createIcon(color: string, size: number = 12): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createPoiIcon(type: "fuel" | "medical" | "rest" | "cafe"): L.DivIcon {
  const icons: Record<string, { emoji: string; bg: string }> = {
    fuel: { emoji: "\u26FD", bg: "#854d0e" },
    medical: { emoji: "\u{2795}", bg: "#991b1b" },
    rest: { emoji: "\u2615", bg: "#1e40af" },
    cafe: { emoji: "\u2615", bg: "#9a3412" },
  };
  const config = icons[type] || icons.rest;
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;border-radius:4px;background:${config.bg};display:flex;align-items:center;justify-content:center;font-size:12px;border:1px solid rgba(255,255,255,0.3);box-shadow:0 0 6px rgba(0,0,0,0.5)">${config.emoji}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const MARKER_ICONS: Record<
  MapMarker["type"],
  (color?: string) => L.DivIcon
> = {
  start: () => createIcon("#FF6B2B", 16),
  waypoint: () => createIcon("#3B82F6", 10),
  routeEnd: () => createIcon("#3B82F6", 10),
  destination: () => createIcon("#10B981", 16),
  fuel: () => createPoiIcon("fuel"),
  medical: () => createPoiIcon("medical"),
  cafe: () => createPoiIcon("cafe"),
  rider: (color?: string) => createIcon(color || "#3B82F6", 12),
};

interface LatLng {
  lat: number;
  lng: number;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(
      points.map((p) => [p.lat, p.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);

  return null;
}

export default function Map({ legs, markers = [], fitBounds: doFitBounds = true }: MapProps) {
  // Collect all points from legs + markers for bounds fitting
  const allPoints: LatLng[] = [];

  for (const leg of legs) {
    for (const [lat, lng] of leg.polyline) {
      allPoints.push({ lat, lng });
    }
  }
  for (const marker of markers) {
    allPoints.push({ lat: marker.position[0], lng: marker.position[1] });
  }

  // Default center: first marker or first polyline point or Melbourne
  const defaultCenter: [number, number] =
    markers.length > 0
      ? markers[0].position
      : legs.length > 0 && legs[0].polyline.length > 0
        ? legs[0].polyline[0]
        : [-37.8136, 144.9631];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={10}
      className="h-80 sm:h-96 w-full rounded-lg"
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      {doFitBounds && allPoints.length > 0 && <FitBounds points={allPoints} />}

      {/* Render legs */}
      {legs.map((leg, i) => (
        <Polyline
          key={`leg-${i}`}
          positions={leg.polyline}
          pathOptions={LEG_STYLES[leg.style](leg.color)}
        />
      ))}

      {/* Render markers */}
      {markers.map((marker, i) => {
        const icon = MARKER_ICONS[marker.type](marker.color);
        const zOffset = marker.type === "destination" ? 1000 : 0;

        return (
          <Marker
            key={`marker-${i}`}
            position={marker.position}
            icon={icon}
            zIndexOffset={zOffset}
          >
            {marker.label && (
              <Popup>
                <div style={{ color: "#000", fontSize: "12px" }}>
                  <strong>{marker.label}</strong>
                </div>
              </Popup>
            )}
          </Marker>
        );
      })}
    </MapContainer>
  );
}
