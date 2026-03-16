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
import type { PointOfInterest } from "@/lib/poi";

interface LatLng {
  lat: number;
  lng: number;
}

export interface RiderMarker {
  lat: number;
  lng: number;
  color: string;
  displayName: string;
}

interface MapProps {
  meetingPoint: LatLng;
  waypoints: LatLng[];
  destination: LatLng;
  riders: RiderMarker[];
  pois?: PointOfInterest[];
  routeGeometry?: [number, number][];
  commuteGeometries?: Record<number, [number, number][]>;
}

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

const meetingIcon = createIcon("#FF6B2B", 16);
const waypointIcon = createIcon("#3B82F6", 10);
const destinationIcon = createIcon("#10B981", 16);
const fuelIcon = createPoiIcon("fuel");
const medicalIcon = createPoiIcon("medical");
const cafeIcon = createPoiIcon("cafe");

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

export default function Map({
  meetingPoint,
  waypoints,
  destination,
  riders,
  pois = [],
  routeGeometry,
  commuteGeometries,
}: MapProps) {
  const allPoints = [
    meetingPoint,
    ...waypoints,
    destination,
    ...riders.map((r) => ({ lat: r.lat, lng: r.lng })),
  ];

  // Use OSRM road geometry if available, otherwise fall back to straight lines
  const routeLine: [number, number][] = routeGeometry || [
    [meetingPoint.lat, meetingPoint.lng],
    ...waypoints.map((wp): [number, number] => [wp.lat, wp.lng]),
    [destination.lat, destination.lng],
  ];

  return (
    <MapContainer
      center={[meetingPoint.lat, meetingPoint.lng]}
      zoom={10}
      className="h-80 sm:h-96 w-full rounded-lg"
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      <FitBounds points={allPoints} />

      {/* Rider commute lines — dashed, in each rider's color */}
      {riders.map((rider, i) => (
        <Polyline
          key={`commute-${i}`}
          positions={
            commuteGeometries?.[i] || [
              [rider.lat, rider.lng],
              [meetingPoint.lat, meetingPoint.lng],
            ]
          }
          pathOptions={{
            color: rider.color,
            weight: 2,
            opacity: 0.6,
            dashArray: "6, 8",
          }}
        />
      ))}

      {/* Route line — solid orange */}
      <Polyline
        positions={routeLine}
        pathOptions={{ color: "#FF6B2B", weight: 3, opacity: 0.9 }}
      />

      {/* POI markers */}
      {pois.map((poi, i) => (
        <Marker
          key={`poi-${i}`}
          position={[poi.lat, poi.lng]}
          icon={poi.type === "fuel" ? fuelIcon : poi.type === "medical" ? medicalIcon : poi.type === "cafe" ? cafeIcon : createPoiIcon("rest")}
        >
          <Popup>
            <div style={{ color: "#000", fontSize: "12px" }}>
              <strong>{poi.name}</strong>
              {poi.notes && <p style={{ margin: "4px 0 0", fontSize: "11px" }}>{poi.notes}</p>}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Rider markers */}
      {riders.map((rider, i) => (
        <Marker
          key={`r-${i}`}
          position={[rider.lat, rider.lng]}
          icon={createIcon(rider.color, 12)}
        />
      ))}

      {/* Meeting point */}
      <Marker
        position={[meetingPoint.lat, meetingPoint.lng]}
        icon={meetingIcon}
      />

      {/* Waypoints */}
      {waypoints.map((wp, i) => (
        <Marker
          key={`wp-${i}`}
          position={[wp.lat, wp.lng]}
          icon={waypointIcon}
        />
      ))}

      {/* Destination — rendered last with high z-index to stay on top of route line */}
      <Marker
        position={[destination.lat, destination.lng]}
        icon={destinationIcon}
        zIndexOffset={1000}
      />
    </MapContainer>
  );
}
