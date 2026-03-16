"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Route, Vibe, Difficulty } from "@/lib/routeMatcher";
import type { ScoredMeetingPoint } from "@/lib/midpoint";
import type { RiderLocation } from "./RiderInput";
import type { MapLeg, MapMarker } from "./Map";
import type { RoutePlan } from "@/lib/route-engine";
import type { PointOfInterest } from "@/lib/poi";
import MeetingPointCard from "./MeetingPoint";
import PointsOfInterestSection from "./PointsOfInterest";
import RouteGallery from "./RouteGallery";
import { RIDER_COLORS } from "@/lib/constants";
import { encodeRidePlan } from "@/lib/shareUrl";
import { buildGoogleMapsUrl, buildWazeUrl, buildAppleMapsUrl } from "@/lib/nav-url-builder";
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
  isSoloRide?: boolean;
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
  isSoloRide,
}: RouteResultProps) {
  const [selectedDest, setSelectedDest] = useState(0);
  const [copied, setCopied] = useState(false);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fuelPlan, setFuelPlan] = useState<FuelPlan | null>(null);
  const [showFullRouteNav, setShowFullRouteNav] = useState(false);

  const destination = route.destinations[selectedDest];
  const mp = scored.meetingPoint;

  // Cache the CDN polyline URL so we don't re-fetch when destination changes
  const polylineCacheRef = useRef<{ url: string; polyline: [number, number][] } | null>(null);

  // Track route completed when result is shown
  useEffect(() => {
    trackEvent("route_completed", { routeId: route.id, routeName: route.name });
  }, [route.id, route.name]);

  // Load route plan from the API
  const loadPlan = useCallback(
    async (destName: string, direction?: "forward" | "reverse") => {
      setLoading(true);
      try {
        // 1. Call API for the plan
        const res = await fetch("/api/route-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            routeId: route.id,
            direction,
            userLat: riders[0]?.lat,
            userLng: riders[0]?.lng,
            destinationName: destName,
          }),
        });

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const plan: RoutePlan = await res.json();
        setRoutePlan(plan);

        // 2. Fetch the CDN polyline for the main route leg (only if not cached or URL changed)
        const routeLeg = plan.legs.find((l) => l.type === "route");
        if (routeLeg?.polylineUrl) {
          if (
            polylineCacheRef.current &&
            polylineCacheRef.current.url === routeLeg.polylineUrl
          ) {
            // Already cached — reuse
            setRoutePolyline(polylineCacheRef.current.polyline);
          } else {
            const polyRes = await fetch(routeLeg.polylineUrl);
            if (polyRes.ok) {
              const polyData: { polyline: [number, number][] } = await polyRes.json();
              setRoutePolyline(polyData.polyline);
              polylineCacheRef.current = {
                url: routeLeg.polylineUrl,
                polyline: polyData.polyline,
              };
            }
          }
        }
      } catch {
        // API failed — leave plan null, UI shows loading or fallback
      } finally {
        setLoading(false);
      }
    },
    [route.id, riders]
  );

  // Initial load
  useEffect(() => {
    loadPlan(destination.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id]);

  // Re-call API when destination changes (polyline stays cached)
  useEffect(() => {
    if (!loading) {
      loadPlan(destination.name, routePlan?.direction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDest]);

  // Compute fuel plan when route plan + rangeKm are available
  useEffect(() => {
    if (rangeKm === undefined || !routePlan) return;

    const waypoints = [
      { lat: mp.lat, lng: mp.lng },
      ...route.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng })),
      { lat: destination.lat, lng: destination.lng },
    ];

    const plan = planFuelStops(
      route.id,
      waypoints,
      rangeKm,
      routePlan.totalDistanceKm
    );
    setFuelPlan(plan);
  }, [route.id, route.waypoints, mp.lat, mp.lng, destination.lat, destination.lng, rangeKm, routePlan]);

  // Get POIs for this route
  const routePois: PointOfInterest[] =
    (poiData as Record<string, PointOfInterest[]>)[route.id] || [];

  // Build map legs
  const mapLegs: MapLeg[] = [];

  // Commute leg (user -> route start)
  const commuteLeg = routePlan?.legs.find((l) => l.type === "commute");
  if (commuteLeg?.polyline) {
    mapLegs.push({ polyline: commuteLeg.polyline, style: "dashed-rider" });
  } else if (riders[0] && routePlan) {
    // Fallback: straight line from rider to route start
    const routeStart =
      routePlan.direction === "forward"
        ? route.waypoints[0]
        : route.waypoints[route.waypoints.length - 1];
    mapLegs.push({
      polyline: [
        [riders[0].lat, riders[0].lng],
        [routeStart.lat, routeStart.lng],
      ],
      style: "dashed-rider",
    });
  }

  // Main route (from CDN)
  if (routePolyline) {
    mapLegs.push({ polyline: routePolyline, style: "solid-orange" });
  } else {
    // Fallback: straight lines through waypoints
    const wpLine: [number, number][] = route.waypoints.map((wp) => [wp.lat, wp.lng]);
    if (wpLine.length > 0) {
      mapLegs.push({ polyline: wpLine, style: "solid-orange" });
    }
  }

  // Destination leg
  const destLeg = routePlan?.legs.find((l) => l.type === "destination");
  if (destLeg?.polyline) {
    mapLegs.push({ polyline: destLeg.polyline, style: "dashed-orange" });
  } else if (destination.position === "endpoint") {
    // Fallback: straight line from route end to destination
    const routeEnd = route.waypoints[route.waypoints.length - 1];
    mapLegs.push({
      polyline: [
        [routeEnd.lat, routeEnd.lng],
        [destination.lat, destination.lng],
      ],
      style: "dashed-orange",
    });
  }

  // Build markers
  const mapMarkers: MapMarker[] = [];

  // Rider markers
  riders.forEach((r, i) => {
    mapMarkers.push({
      position: [r.lat, r.lng],
      type: "rider",
      label: r.displayName,
      color: RIDER_COLORS[i % RIDER_COLORS.length],
    });
  });

  // Meeting point / start
  mapMarkers.push({
    position: [mp.lat, mp.lng],
    type: "start",
    label: isSoloRide ? "Start" : mp.name,
  });

  // Waypoints
  route.waypoints.forEach((wp) => {
    mapMarkers.push({
      position: [wp.lat, wp.lng],
      type: "waypoint",
      label: wp.label,
    });
  });

  // Route end
  const routeEnd = route.waypoints[route.waypoints.length - 1];
  mapMarkers.push({
    position: [routeEnd.lat, routeEnd.lng],
    type: "routeEnd",
    label: routeEnd.label,
  });

  // Destination
  mapMarkers.push({
    position: [destination.lat, destination.lng],
    type: "destination",
    label: destination.name,
  });

  // POI markers
  routePois.forEach((poi) => {
    const poiType = poi.type === "fuel" ? "fuel" : poi.type === "medical" ? "medical" : "cafe";
    mapMarkers.push({
      position: [poi.lat, poi.lng],
      type: poiType,
      label: poi.name,
    });
  });

  // Build nav URLs — prefer client-side polyline-based URLs
  const origin = riders[0] ? { lat: riders[0].lat, lng: riders[0].lng } : { lat: mp.lat, lng: mp.lng };
  const destLatLng = { lat: destination.lat, lng: destination.lng };

  const googleUrl = routePolyline
    ? buildGoogleMapsUrl(origin, routePolyline, destLatLng)
    : routePlan?.googleMapsUrl ??
      `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;

  const wazeUrl = routePlan
    ? buildWazeUrl(
        origin,
        routePlan.direction === "forward"
          ? { lat: route.waypoints[0].lat, lng: route.waypoints[0].lng }
          : {
              lat: route.waypoints[route.waypoints.length - 1].lat,
              lng: route.waypoints[route.waypoints.length - 1].lng,
            }
      )
    : `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;

  const appleUrl = routePolyline
    ? buildAppleMapsUrl(origin, routePolyline, destLatLng)
    : routePlan?.appleMapsUrl ??
      `https://maps.apple.com/?daddr=${destination.lat},${destination.lng}&dirflg=d`;

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

  // Timing display from route plan
  const totalDistanceKm = routePlan?.totalDistanceKm ?? route.distanceKm;
  const totalDurationMinutes = routePlan?.totalDurationMinutes ?? route.durationMinutes;

  return (
    <div className="space-y-4">
      {/* ATGATT safety banner — always visible */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#1A1A0A] border border-yellow-500/20">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-400/90 flex-shrink-0" aria-hidden="true">
          <path fillRule="evenodd" d="M11.484 2.17a.75.75 0 0 1 1.032 0 11.209 11.209 0 0 0 7.877 3.08.75.75 0 0 1 .722.515 12.74 12.74 0 0 1 .635 3.985c0 5.942-4.064 10.933-9.563 12.348a.749.749 0 0 1-.374 0C6.314 20.683 2.25 15.692 2.25 9.75c0-1.39.223-2.73.635-3.985a.75.75 0 0 1 .722-.516 11.209 11.209 0 0 0 7.877-3.08Z" clipRule="evenodd" />
        </svg>
        <p className="text-xs text-yellow-400/90 leading-snug">
          Prepare for the slide, not the ride. Wear all your gear, all the time.
        </p>
      </div>

      {/* Reverse direction suggestion */}
      {routePlan?.suggestReverse && routePlan.direction !== "reverse" && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-[#1A1A0A] border border-[#FF6B2B]/30">
          <p className="text-xs text-zinc-300 leading-snug">
            You&apos;re closer to the end of this route. Ride it in reverse?
          </p>
          <button
            onClick={() => loadPlan(destination.name, "reverse")}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#FF6B2B]/10 border border-[#FF6B2B]/30 text-xs text-[#FF6B2B] font-semibold hover:bg-[#FF6B2B]/20 transition-colors"
          >
            Ride in reverse
          </button>
        </div>
      )}

      <MeetingPointCard
        point={mp}
        riderDistances={scored.riderDistances}
        isSoloRide={isSoloRide}
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
          {totalDistanceKm > rangeKm && (
            <span className="ml-2 text-yellow-400 font-medium">
              (route exceeds range)
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="h-80 sm:h-96 w-full rounded-lg bg-[#141414] border border-[#2A2A2A] flex items-center justify-center">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading route...
          </div>
        </div>
      ) : (
        <Map
          key={`${route.id}-${routePlan?.direction ?? "forward"}`}
          legs={mapLegs}
          markers={mapMarkers}
        />
      )}

      {/* Destination picker — above fuel plan so changes flow down */}
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
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedDest === i
                    ? "border-[#FF6B2B] bg-[#FF6B2B]/10"
                    : "border-[#2A2A2A] bg-[#141414] hover:border-[#3A3A3A]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium text-sm">
                      {dest.name}
                    </span>
                    <span className="text-xs text-zinc-500 ml-2">
                      {dest.position === "enroute" ? "Along route" : "End point"}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">{dest.type}</span>
                </div>
                {dest.description && (
                  <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                    {dest.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fuel Plan — shown immediately below destination picker */}
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
            {totalDistanceKm} km
          </span>
          <span className="text-xs text-zinc-500">&middot;</span>
          <span className="text-xs text-zinc-500">
            ~{Math.round(totalDurationMinutes / 60)}h{" "}
            {totalDurationMinutes % 60}m
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

        {/* Leg-by-leg timing breakdown */}
        {routePlan && routePlan.legs.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 font-semibold">Estimated timing</p>
              <p className="text-xs text-zinc-400 font-medium">
                ~{totalDurationMinutes >= 60
                  ? `${Math.floor(totalDurationMinutes / 60)}h ${totalDurationMinutes % 60}m`
                  : `${totalDurationMinutes}m`} total
              </p>
            </div>
            {routePlan.legs.map((leg, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-zinc-500">
                <span className="truncate mr-2">{leg.label}</span>
                <span className="tabular-nums shrink-0">
                  {leg.distanceKm} km &middot; ~{leg.durationMinutes} min
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Fallback timing when plan hasn't loaded */}
        {!routePlan && route.waypoints.length > 0 && (() => {
          const segments: { from: string; to: string }[] = [];
          const wpLabels = route.waypoints.map((wp) => wp.label);
          const startLabel = isSoloRide ? "Start" : "Meeting point";

          segments.push({ from: startLabel, to: wpLabels[0] });
          for (let i = 0; i < wpLabels.length - 1; i++) {
            segments.push({ from: wpLabels[i], to: wpLabels[i + 1] });
          }
          segments.push({ from: wpLabels[wpLabels.length - 1], to: destination.name });

          const isEnroute = destination.position === "enroute";
          const totalSegments = route.waypoints.length + 1;
          const activeSegments = segments.length;
          const estimatedTotalMin = isEnroute
            ? Math.round(route.durationMinutes * (activeSegments / totalSegments) * 0.8)
            : route.durationMinutes;
          const minutesPerSegment = Math.round(estimatedTotalMin / activeSegments);
          const totalTimeStr = estimatedTotalMin >= 60
            ? `${Math.floor(estimatedTotalMin / 60)}h ${estimatedTotalMin % 60}m`
            : `${estimatedTotalMin}m`;

          return (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 font-semibold">Estimated timing</p>
                <p className="text-xs text-zinc-400 font-medium">~{totalTimeStr} total</p>
              </div>
              {segments.map((seg, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="truncate mr-2">{seg.from} &rarr; {seg.to}</span>
                  <span className="tabular-nums shrink-0">~{minutesPerSegment} min</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Route Photos */}
      <RouteGallery routeId={route.id} />

      {/* Points of Interest */}
      {routePois.length > 0 && (
        <PointsOfInterestSection
          pois={routePois}
          routeDistanceKm={route.distanceKm}
        />
      )}

      {/* Navigation CTAs */}
      <div className="space-y-2">
        {/* Start full navigation */}
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("nav_link_clicked", { app: "Google Maps", target: "full_route" })}
          className="block w-full h-12 rounded-lg bg-[#FF6B2B] text-white font-semibold text-sm text-center leading-[3rem] hover:bg-[#FF8B5B] transition-colors"
        >
          Start full navigation &rarr;
        </a>

        {/* Navigate to starting point/meeting point only */}
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${mp.lat},${mp.lng}&travelmode=driving`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("nav_link_clicked", { app: "Google Maps", target: "meeting_point" })}
          className="block w-full h-10 rounded-lg border border-[#2A2A2A] text-zinc-400 font-medium text-sm text-center leading-[2.5rem] hover:border-[#FF6B2B]/50 hover:text-white transition-colors"
        >
          {isSoloRide ? "Navigate to starting point" : "Navigate to meeting point"}
        </a>
      </div>

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
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
              Open in
            </p>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("nav_link_clicked", { app: "Google Maps" })}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-[#141414] border border-[#2A2A2A] hover:border-[#FF6B2B] transition-colors text-center"
              >
                <span className="text-xl">{"\u{1F5FA}\uFE0F"}</span>
                <span className="text-xs text-zinc-400 font-medium">Google Maps</span>
              </a>
              <a
                href={wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("nav_link_clicked", { app: "Waze" })}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-[#141414] border border-[#2A2A2A] hover:border-[#FF6B2B] transition-colors text-center"
              >
                <span className="text-xl">{"\u{1F698}"}</span>
                <span className="text-xs text-zinc-400 font-medium">Waze</span>
              </a>
              <a
                href={appleUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("nav_link_clicked", { app: "Apple Maps" })}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-[#141414] border border-[#2A2A2A] hover:border-[#FF6B2B] transition-colors text-center"
              >
                <span className="text-xl">{"\u{1F34E}"}</span>
                <span className="text-xs text-zinc-400 font-medium">Apple Maps</span>
              </a>
            </div>
          </div>
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
        <br />
        <a
          href="https://github.com/sharifelshenawy/inf3rno/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 hover:text-[#FF6B2B] transition-colors"
        >
          Give feedback or report a bug
        </a>
      </p>
    </div>
  );
}
