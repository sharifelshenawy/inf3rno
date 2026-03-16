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
import { trackEvent } from "@/lib/analytics";
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
  const [showAtgatt, setShowAtgatt] = useState(false);
  const [showFullRouteNav, setShowFullRouteNav] = useState(false);

  // ATGATT banner: show unless dismissed within the last 7 days
  useEffect(() => {
    const STORAGE_KEY = "inf3rno_atgatt_dismissed";
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < sevenDaysMs) return;
    }
    setShowAtgatt(true);
  }, []);

  const dismissAtgatt = () => {
    localStorage.setItem("inf3rno_atgatt_dismissed", String(Date.now()));
    setShowAtgatt(false);
  };

  const destination = route.destinations[selectedDest];
  const mp = scored.meetingPoint;

  // Track route completed when result is shown
  useEffect(() => {
    trackEvent("route_completed", { routeId: route.id, routeName: route.name });
  }, [route.id, route.name]);

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

  const handleShare = async () => {
    trackEvent("share_clicked", { routeId: route.id });
    const url = encodeRidePlan({
      riders,
      vibe,
      difficulty,
      routeId: route.id,
      destinationIdx: selectedDest,
    });

    const shareTitle = `Check out my ride — ${route.name}`;
    const shareText = `${route.name} — ${route.distanceKm}km, ~${Math.round(route.durationMinutes / 60)}h ${route.durationMinutes % 60}m. Planned with inf3rno`;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url,
        });
        trackEvent("share_clicked", { routeId: route.id, method: "native" });
        return;
      } catch (err) {
        // User cancelled or share failed - fall through to clipboard
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="space-y-4">
      {/* ATGATT safety banner */}
      {showAtgatt && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#1A1A0A] border border-yellow-500/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5 text-yellow-400/90 flex-shrink-0"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M11.484 2.17a.75.75 0 0 1 1.032 0 11.209 11.209 0 0 0 7.877 3.08.75.75 0 0 1 .722.515 12.74 12.74 0 0 1 .635 3.985c0 5.942-4.064 10.933-9.563 12.348a.749.749 0 0 1-.374 0C6.314 20.683 2.25 15.692 2.25 9.75c0-1.39.223-2.73.635-3.985a.75.75 0 0 1 .722-.516 11.209 11.209 0 0 0 7.877-3.08Z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs text-yellow-400/90 leading-snug">
            Prepare for the slide, not the ride. Wear all your gear, all the time.
          </p>
          <button
            onClick={dismissAtgatt}
            className="ml-auto flex-shrink-0 p-1 text-yellow-400/50 hover:text-yellow-400/80 transition-colors"
            aria-label="Dismiss safety reminder"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      )}

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

      {/* Fuel Plan — shown immediately below map for visibility */}
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

        {/* Estimated timing at waypoints */}
        {route.waypoints.length > 0 && (() => {
          const segments: { from: string; to: string }[] = [];
          const wpLabels = route.waypoints.map((wp) => wp.label);

          segments.push({ from: "Meeting point", to: wpLabels[0] });
          for (let i = 0; i < wpLabels.length - 1; i++) {
            segments.push({ from: wpLabels[i], to: wpLabels[i + 1] });
          }
          segments.push({ from: wpLabels[wpLabels.length - 1], to: destination.name });

          const minutesPerSegment = Math.round(route.durationMinutes / segments.length);

          return (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-500 font-semibold">Estimated timing</p>
              {segments.map((seg, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{seg.from} &rarr; {seg.to}</span>
                  <span className="tabular-nums">~{minutesPerSegment} min</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

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

      {/* Navigate to meeting point — primary CTA */}
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${mp.lat},${mp.lng}&travelmode=driving`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent("nav_link_clicked", { app: "Google Maps", target: "meeting_point" })}
        className="block w-full h-12 rounded-lg bg-[#FF6B2B] text-white font-semibold text-sm text-center leading-[3rem] hover:bg-[#FF8B5B] transition-colors"
      >
        Navigate to Meeting Point &rarr;
      </a>

      {/* Full route navigation — collapsible */}
      <div className="space-y-2">
        <button
          onClick={() => setShowFullRouteNav((prev) => !prev)}
          className="flex items-center justify-between w-full text-xs text-zinc-500 uppercase tracking-wider font-semibold"
        >
          <span>Full route navigation</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 transition-transform ${showFullRouteNav ? "rotate-180" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {showFullRouteNav && (
          <NavLinks
            meetingPoint={{ lat: mp.lat, lng: mp.lng }}
            waypoints={route.waypoints.map((wp) => ({
              lat: wp.lat,
              lng: wp.lng,
            }))}
            destination={{ lat: destination.lat, lng: destination.lng }}
          />
        )}
      </div>

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
