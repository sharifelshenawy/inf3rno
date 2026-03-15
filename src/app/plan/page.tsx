"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import VibePicker from "@/components/VibePicker";
import RouteSelector from "@/components/RouteSelector";
import RouteResult from "@/components/RouteResult";
import { findOptimalMeetingPoint } from "@/lib/midpoint";
import type { ScoredMeetingPoint } from "@/lib/midpoint";
import { filterRoutes } from "@/lib/routeMatcher";
import type { Route, Vibe, Difficulty } from "@/lib/routeMatcher";
import { decodeRidePlan } from "@/lib/shareUrl";
import { computeRangeKm } from "@/lib/types";
import { geocodeSuburb } from "@/lib/geocode";
import type { RiderLocation } from "@/components/RiderInput";
import routesData from "@/data/routes.json";

type Step = "location" | "vibe" | "routes" | "loading" | "result";

const STEPS: { key: Step; label: string }[] = [
  { key: "location", label: "Location" },
  { key: "vibe", label: "Vibe" },
  { key: "routes", label: "Route" },
  { key: "result", label: "Plan" },
];

export default function SoloPlan() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-zinc-500">Loading...</div>
      }
    >
      <SoloPlanContent />
    </Suspense>
  );
}

function SoloPlanContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("location");
  const [rider, setRider] = useState<RiderLocation | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [vibe, setVibe] = useState<Vibe>("mix");
  const [difficulty, setDifficulty] = useState<Difficulty>("any");
  const [candidateRoutes, setCandidateRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [scored, setScored] = useState<ScoredMeetingPoint | null>(null);
  const [rangeKm, setRangeKm] = useState<number | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [usingGps, setUsingGps] = useState(false);

  const computeMeetingPoint = useCallback(
    (route: Route, riderLoc: RiderLocation) => {
      setStep("loading");
      setTimeout(() => {
        const routeStart = {
          lat: route.waypoints[0].lat,
          lng: route.waypoints[0].lng,
        };
        const result = findOptimalMeetingPoint([riderLoc], routeStart);
        setScored(result);
        setStep("result");
      }, 600);
    },
    []
  );

  // Fetch user profile on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const profile = await res.json();

        if (cancelled) return;

        // Pre-fill location from profile suburb
        if (profile.suburb && profile.suburbLat && profile.suburbLng) {
          const displayName = profile.displayName || profile.handle || "You";
          setRider({
            displayName,
            lat: profile.suburbLat,
            lng: profile.suburbLng,
          });
          setLocationInput(profile.suburb);
        }

        // Compute bike range from primary bike
        const bikes = profile.bikes || [];
        const primaryBike = bikes.find((b: { isPrimary: boolean }) => b.isPrimary) || bikes[0];
        if (primaryBike) {
          setRangeKm(computeRangeKm(primaryBike));
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setProfileLoaded(true);
      }
    }

    fetchProfile();
    return () => { cancelled = true; };
  }, []);

  // Check for shared URL on mount
  useEffect(() => {
    if (!profileLoaded) return;
    const plan = decodeRidePlan(searchParams);
    if (plan && plan.riders.length > 0) {
      setRider(plan.riders[0]);
      setLocationInput(plan.riders[0].displayName);
      setVibe(plan.vibe);
      setDifficulty(plan.difficulty);

      if (plan.routeId) {
        const route = (routesData as Route[]).find((r) => r.id === plan.routeId);
        if (route) {
          setSelectedRoute(route);
          computeMeetingPoint(route, plan.riders[0]);
          return;
        }
      }
    }
  }, [searchParams, computeMeetingPoint, profileLoaded]);

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setLocationError("GPS not available on this device");
      return;
    }
    setUsingGps(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRider({
          displayName: "Current location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationInput("Current location (GPS)");
        setUsingGps(false);
      },
      () => {
        setLocationError("Couldn't get your location. Try entering it manually.");
        setUsingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLocationSubmit = async () => {
    if (!locationInput.trim()) return;
    setLocationLoading(true);
    setLocationError("");

    const result = await geocodeSuburb(locationInput.trim());
    if (result) {
      setRider({
        displayName: result.displayName,
        lat: result.lat,
        lng: result.lng,
      });
      setLocationLoading(false);
      setStep("vibe");
    } else {
      setLocationError("Couldn't find that location. Try a suburb name or postcode.");
      setLocationLoading(false);
    }
  };

  const handleLocationNext = () => {
    if (rider) setStep("vibe");
  };

  const handleVibeSubmit = (selectedVibe: Vibe, selectedDifficulty: Difficulty) => {
    setVibe(selectedVibe);
    setDifficulty(selectedDifficulty);
    const filtered = filterRoutes(selectedVibe, selectedDifficulty);
    setCandidateRoutes(filtered);
    setStep("routes");
  };

  const handleRouteSelect = (route: Route) => {
    if (!rider) return;
    setSelectedRoute(route);
    computeMeetingPoint(route, rider);
  };

  const handleReset = () => {
    setVibe("mix");
    setDifficulty("any");
    setCandidateRoutes([]);
    setSelectedRoute(null);
    setScored(null);
    setStep("location");
    window.history.replaceState({}, "", window.location.pathname);
  };

  const currentStepIndex = STEPS.findIndex(
    (s) => s.key === (step === "loading" ? "result" : step)
  );

  if (!profileLoaded) {
    return (
      <div className="py-20 text-center text-zinc-500">
        Loading your profile...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Range indicator */}
      {rangeKm !== null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#141414] border border-[#2A2A2A] text-xs text-zinc-400">
          <span className="text-[#FF6B2B]">&#x26FD;</span>
          <span>Fuel range: <strong className="text-white">{Math.round(rangeKm)} km</strong></span>
        </div>
      )}

      {/* Progress indicator */}
      {step !== "result" && (
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i <= currentStepIndex
                      ? "bg-[#FF6B2B] text-white"
                      : "bg-[#141414] text-zinc-500 border border-[#2A2A2A]"
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    i <= currentStepIndex ? "text-white" : "text-zinc-500"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 ${
                    i < currentStepIndex ? "bg-[#FF6B2B]" : "bg-[#2A2A2A]"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step content */}
      <div
        className="transition-opacity duration-300"
        style={{ opacity: step === "loading" ? 0.5 : 1 }}
      >
        {step === "location" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Where are you riding from?
              </h2>
              <p className="text-sm text-zinc-400">
                We&apos;ll find routes and meeting spots near you.
              </p>
            </div>

            {/* GPS button */}
            <button
              onClick={handleUseGps}
              disabled={usingGps}
              className="w-full h-12 rounded-lg border border-[#2A2A2A] bg-[#141414] text-white font-medium hover:border-[#FF6B2B]/50 transition-colors flex items-center justify-center gap-2"
            >
              {usingGps ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Getting location...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-[#FF6B2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  Use my current location
                </>
              )}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#2A2A2A]" />
              <span className="text-xs text-zinc-600">or enter manually</span>
              <div className="h-px flex-1 bg-[#2A2A2A]" />
            </div>

            {/* Manual location input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLocationSubmit();
                  }
                }}
                placeholder="e.g. Clyde, Monbulk, 3140"
                className="flex-1 h-12 px-4 rounded-lg bg-[#141414] border border-[#2A2A2A] text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FF6B2B] transition-colors"
              />
              <button
                onClick={handleLocationSubmit}
                disabled={locationLoading || !locationInput.trim()}
                className="h-12 px-5 rounded-lg bg-[#FF6B2B] text-white font-semibold hover:bg-[#FF6B2B]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {locationLoading ? "..." : "Set"}
              </button>
            </div>

            {locationError && (
              <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
                {locationError}
              </p>
            )}

            {/* Show current location if set */}
            {rider && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#141414] border border-[#FF6B2B]/30">
                <div className="w-3 h-3 rounded-full bg-[#FF6B2B]" />
                <span className="text-white font-medium">{rider.displayName}</span>
                <span className="text-xs text-zinc-500 ml-auto">
                  {rider.lat.toFixed(3)}, {rider.lng.toFixed(3)}
                </span>
              </div>
            )}

            {rider && (
              <button
                onClick={handleLocationNext}
                className="w-full h-14 rounded-lg bg-[#FF6B2B] text-white text-lg font-bold hover:bg-[#FF6B2B]/90 transition-colors"
              >
                Choose your vibe
              </button>
            )}
          </div>
        )}

        {step === "vibe" && (
          <VibePicker
            onSubmit={handleVibeSubmit}
            onBack={() => setStep("location")}
          />
        )}

        {step === "routes" && (
          <RouteSelector
            routes={candidateRoutes}
            onSelect={handleRouteSelect}
            onBack={() => setStep("vibe")}
          />
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <svg className="animate-spin h-10 w-10 text-[#FF6B2B]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-zinc-400 text-sm">Finding your perfect ride...</p>
          </div>
        )}

        {step === "result" && selectedRoute && scored && rider && (
          <RouteResult
            route={selectedRoute}
            scored={scored}
            riders={[rider]}
            vibe={vibe}
            difficulty={difficulty}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
