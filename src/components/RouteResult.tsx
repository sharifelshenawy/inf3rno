"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Route, Vibe, Difficulty } from "@/lib/routeMatcher";
import type { ScoredMeetingPoint } from "@/lib/midpoint";
import type { RiderLocation } from "./RiderInput";
import type { RiderMarker } from "./Map";
import type { PointOfInterest } from "@/lib/poi";
import MeetingPointCard from "./MeetingPoint";
import NavLinks from "./NavLinks";
import PointsOfInterestSection from "./PointsOfInterest";
import RouteGallery from "./RouteGallery";
import { RIDER_COLORS } from "@/lib/constants";
import { encodeRidePlan } from "@/lib/shareUrl";
import { fetchRouteGeometry } from "@/lib/routing";
import { planFuelStops } from "@/lib/fuel-planner";
import poiData from "@/data/poi.json";

type FuelPlan = ReturnType<typeof planFuelStops>;

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

interface RouteResultProps {
  route: Route;
  scored: ScoredMeetingPoint;
  riders: RiderLocation[];
  vibe: Vibe;
  difficulty: Difficulty;
  onReset: () => void;
  rangeKm?: number;
  bikeName?: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function RouteResult({
  route,
  scored,
  riders,
  vibe,
  difficulty,
  onReset,
  rangeKm,
  bikeName,
}: RouteResultProps) {
  const [selectedDest, setSelectedDest] = useState(0);
  const [copied, setCopied] = useState(false);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | undefined>();
  const [commuteGeometries, setCommuteGeometries] = useState<Record<number, [number, number][]>>({});
  const [fuelPlan, setFuelPlan] = useState<FuelPlan | null>(null);

  const destination = route.destinations[selectedDest];
  const mp = scored.meetingPoint;

  // Compute fuel plan when route + rangeKm are available
  useEffect(() => {
    if (rangeKm === undefined) return;

    const waypoints = [
      { lat: mp.lat, lng: mp.lng },
      ...route.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng })),
      { lat: destination.lat, lng: destination.lng },
    ];

    const plan = planFuelStops(route.id, waypoints, rangeKm);
    setFuelPlan(plan);
  }, [route.id, route.waypoints, mp.lat, mp.lng, destination.lat, destination.lng, rangeKm]);

  const riderMarkers: RiderMarker[] = riders.map((r, i) => ({
    lat: r.lat,
    lng: r.lng,
    color: RIDER_COLORS[i % RIDER_COLORS.length],
    displayName: r.displayName,
  }));

  // Get POIs for this route
  const routePois: PointOfInterest[] =
    (poiData as Record<string, PointOfInterest[]>)[route.id] || [];

  // Fetch road-following geometries
  const fetchGeometries = useCallback(async () => {
    try {
      // Fetch route geometry: meeting point → waypoints → destination
      const routePoints = [
        { lat: mp.lat, lng: mp.lng },
        ...route.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng })),
        { lat: destination.lat, lng: destination.lng },
      ];
      const routeGeo = await fetchRouteGeometry(routePoints);
      if (routeGeo) setRouteGeometry(routeGeo);

      // Fetch commute geometries for each rider
      const commutes: Record<number, [number, number][]> = {};
      for (let i = 0; i < riders.length; i++) {
        const commuteGeo = await fetchRouteGeometry([
          { lat: riders[i].lat, lng: riders[i].lng },
          { lat: mp.lat, lng: mp.lng },
        ]);
        if (commuteGeo) commutes[i] = commuteGeo;
      }
      setCommuteGeometries(commutes);
    } catch {
      // Fall back to straight lines silently
    }
  }, [mp.lat, mp.lng, route.waypoints, destination.lat, destination.lng, riders]);

  useEffect(() => {
    fetchGeometries();
  }, [fetchGeometries]);

  const handleShare = () => {
    const url = encodeRidePlan({
      riders,
      vibe,
      difficulty,
      routeId: route.id,
      destinationIdx: selectedDest,
    });
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <MeetingPointCard
        point={mp}
        riderDistances={scored.riderDistances}
      />

      {/* Bike fuel range */}
      {rangeKm !== undefined && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#141414] border border-[#2A2A2A] text-xs text-zinc-400">
          <span className="text-[#FF6B2B]">&#x26FD;</span>
          <span>
            Fuel range: <strong className="text-white">{Math.round(rangeKm)} km</strong>
          </span>
          {bikeName && (
            <span className="ml-auto text-zinc-500">{bikeName}</span>
          )}
          {route.distanceKm > rangeKm && (
            <span className="ml-2 text-yellow-400 font-medium">
              (route exceeds range)
            </span>
          )}
        </div>
      )}

      <Map
        meetingPoint={{ lat: mp.lat, lng: mp.lng }}
        waypoints={route.waypoints.map((wp) => ({
          lat: wp.lat,
          lng: wp.lng,
        }))}
        destination={{ lat: destination.lat, lng: destination.lng }}
        riders={riderMarkers}
        pois={routePois}
        routeGeometry={routeGeometry}
        commuteGeometries={commuteGeometries}
      />

      {/* Route details */}
      <div className="p-4 rounded-lg bg-[#141414] border border-[#2A2A2A] space-y-3">
        <div>
          <h3 className="text-lg font-bold text-white">{route.name}</h3>
          <p className="text-sm text-zinc-400 mt-1">{route.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              DIFFICULTY_COLORS[route.difficulty] ||
              "bg-zinc-500/20 text-zinc-400"
            }`}
          >
            {route.difficulty}
          </span>
          <span className="text-xs text-zinc-500">
            {route.distanceKm} km
          </span>
          <span className="text-xs text-zinc-500">&middot;</span>
          <span className="text-xs text-zinc-500">
            ~{Math.round(route.durationMinutes / 60)}h{" "}
            {route.durationMinutes % 60}m
          </span>
        </div>

        {route.highlights.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {route.highlights.map((h) => (
              <span
                key={h}
                className="px-2 py-0.5 rounded-full text-xs bg-[#FF6B2B]/10 text-[#FF6B2B] border border-[#FF6B2B]/20"
              >
                {h}
              </span>
            ))}
          </div>
        )}

        {route.warnings.length > 0 && (
          <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
            <p className="text-xs text-yellow-400/80">
              {route.warnings.join(" \u2022 ")}
            </p>
          </div>
        )}
      </div>

      {/* Fuel Plan */}
      {rangeKm !== undefined && fuelPlan && (
        <div className="p-4 rounded-lg bg-[#141414] border border-[#2A2A2A] space-y-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
            Fuel Plan
          </p>

          {!fuelPlan.needsFuelStops ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <span className="text-sm">&#x26FD;</span>
              <p className="text-sm text-[#10B981] font-medium">
                You&apos;re good &mdash; estimated {fuelPlan.arrivalFuelPercent}% fuel at destination
              </p>
            </div>
          ) : (
            <div className="relative pl-6">
              {/* Timeline vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#2A2A2A]" />

              {/* Start marker */}
              <div className="relative flex items-center gap-3 pb-4">
                <div className="absolute left-[-15px] w-[13px] h-[13px] rounded-full bg-[#FF6B2B] border-2 border-[#0A0A0A] z-10" />
                <span className="text-xs text-zinc-400">
                  Depart with full tank &mdash; {Math.round(rangeKm)} km range
                </span>
              </div>

              {/* Fuel stops */}
              {fuelPlan.stops.map((stop, i) => {
                const fuelColor =
                  stop.estimatedFuelRemaining > 40
                    ? "#10B981"
                    : stop.estimatedFuelRemaining >= 20
                      ? "#F59E0B"
                      : "#EF4444";
                const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${stop.poi.lat},${stop.poi.lng}&travelmode=driving`;

                return (
                  <div key={i} className="relative pb-4">
                    <div
                      className="absolute left-[-15px] w-[13px] h-[13px] rounded-full border-2 border-[#0A0A0A] z-10"
                      style={{ backgroundColor: fuelColor }}
                    />
                    <div className="ml-2 p-3 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-white font-medium">
                          &#x26FD; {stop.poi.name}
                        </span>
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded"
                          style={{ color: fuelColor, backgroundColor: `${fuelColor}15` }}
                        >
                          {stop.estimatedFuelRemaining}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>{stop.distanceFromStartKm} km from start</span>
                        <span>&middot;</span>
                        <span>{stop.distanceFromPrevStopKm} km from prev stop</span>
                      </div>
                      {stop.poi.notes && (
                        <p className="text-xs text-zinc-500">{stop.poi.notes}</p>
                      )}
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#FF6B2B] hover:text-[#FF8B5B] transition-colors mt-1"
                      >
                        Open in Google Maps &rarr;
                      </a>
                    </div>
                  </div>
                );
              })}

              {/* Destination arrival */}
              <div className="relative flex items-center gap-3">
                <div
                  className="absolute left-[-15px] w-[13px] h-[13px] rounded-full border-2 border-[#0A0A0A] z-10"
                  style={{
                    backgroundColor:
                      fuelPlan.arrivalFuelPercent > 40
                        ? "#10B981"
                        : fuelPlan.arrivalFuelPercent >= 20
                          ? "#F59E0B"
                          : "#EF4444",
                  }}
                />
                <span className="text-xs text-zinc-400">
                  Arrive at destination with ~
                  <span
                    className="font-semibold"
                    style={{
                      color:
                        fuelPlan.arrivalFuelPercent > 40
                          ? "#10B981"
                          : fuelPlan.arrivalFuelPercent >= 20
                            ? "#F59E0B"
                            : "#EF4444",
                    }}
                  >
                    {fuelPlan.arrivalFuelPercent}%
                  </span>{" "}
                  fuel
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Destination picker */}
      {route.destinations.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
            Destination
          </p>
          <div className="space-y-2">
            {route.destinations.map((dest, i) => (
              <button
                key={i}
                onClick={() => setSelectedDest(i)}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                  selectedDest === i
                    ? "border-[#FF6B2B] bg-[#FF6B2B]/10"
                    : "border-[#2A2A2A] bg-[#141414] hover:border-[#3A3A3A]"
                }`}
              >
                <div>
                  <span className="text-white font-medium text-sm">
                    {dest.name}
                  </span>
                  <span className="text-xs text-zinc-500 ml-2">
                    {dest.position === "enroute" ? "Along route" : "End point"}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">{dest.type}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Route Photos */}
      <RouteGallery routeId={route.id} />

      {/* Points of Interest */}
      {routePois.length > 0 && (
        <PointsOfInterestSection
          pois={routePois}
          routeDistanceKm={route.distanceKm}
        />
      )}

      <NavLinks
        meetingPoint={{ lat: mp.lat, lng: mp.lng }}
        waypoints={route.waypoints.map((wp) => ({
          lat: wp.lat,
          lng: wp.lng,
        }))}
        destination={{ lat: destination.lat, lng: destination.lng }}
      />

      <div className="flex gap-3">
        <button
          onClick={handleShare}
          className="flex-1 h-12 rounded-lg border border-[#2A2A2A] text-white font-semibold hover:border-[#FF6B2B] transition-colors"
        >
          {copied ? "Link copied!" : "Share ride"}
        </button>
        <button
          onClick={onReset}
          className="flex-1 h-12 rounded-lg border border-[#2A2A2A] text-zinc-400 font-semibold hover:border-[#3A3A3A] transition-colors"
        >
          New ride
        </button>
      </div>

      <p className="text-center text-xs text-zinc-600 py-2">
        inf3rno &mdash; Built for Melbourne riders
      </p>
    </div>
  );
}
