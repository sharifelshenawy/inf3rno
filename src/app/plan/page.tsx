"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import VibePicker from "@/components/VibePicker";
import RouteSelector from "@/components/RouteSelector";
import RouteResult from "@/components/RouteResult";
import { findOptimalMeetingPoint } from "@/lib/midpoint";
import type { ScoredMeetingPoint } from "@/lib/midpoint";
import { filterRoutes } from "@/lib/routeMatcher";
import type { Route, Vibe, Difficulty, Duration } from "@/lib/routeMatcher";
import { decodeRidePlan } from "@/lib/shareUrl";
import { computeRangeKm } from "@/lib/types";
import { geocodeSuburb } from "@/lib/geocode";
import type { RiderLocation } from "@/components/RiderInput";
import routesData from "@/data/routes.json";
import bikeSpecsData from "@/data/bikeSpecs.json";
import { trackEvent } from "@/lib/analytics";

interface BikeSpec {
  make: string;
  model: string;
  year: number;
  tankLitres: number;
  consumptionPer100km: number;
  engineCC: number;
}

interface ProfileBike {
  id: string;
  make: string;
  model: string;
  year: number | null;
  tankLitres: number;
  consumptionPer100km: number;
  isManualRange: boolean;
  manualRangeKm: number | null;
  isPrimary: boolean;
}

interface SelectedBikeInfo {
  make: string;
  model: string;
  tankLitres: number;
  consumptionPer100km: number;
  rangeKm: number;
}

interface SavedRidePlan {
  rider: { displayName: string; lat: number; lng: number };
  bike: { make: string; model: string; rangeKm: number } | null;
  vibe: string;
  difficulty: string;
  routeId: string;
  destinationName: string | null;
  savedAt: string;
}

const STORAGE_KEY = "inf3rno_solo_ride";

type Step = "location" | "bike" | "vibe" | "routes" | "loading" | "result";

const STEPS: { key: Step; label: string }[] = [
  { key: "location", label: "Location" },
  { key: "bike", label: "Bike" },
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

  // Bike selection state
  const [selectedBike, setSelectedBike] = useState<SelectedBikeInfo | null>(null);
  const [profileBikes, setProfileBikes] = useState<ProfileBike[]>([]);
  const [showSpecsSelector, setShowSpecsSelector] = useState(false);
  const [specYear, setSpecYear] = useState("");
  const [specMake, setSpecMake] = useState("");
  const [specModel, setSpecModel] = useState("");

  // Saved ride plan state
  const [savedPlan, setSavedPlan] = useState<SavedRidePlan | null>(null);
  const [savedRoute, setSavedRoute] = useState<Route | null>(null);

  const bikeSpecs = bikeSpecsData as BikeSpec[];

  // Cascading bike spec filters
  const uniqueYears = useMemo(
    () => [...new Set(bikeSpecs.map((b) => b.year))].sort((a, b) => b - a),
    [bikeSpecs]
  );

  const filteredMakes = useMemo(
    () =>
      specYear
        ? [...new Set(bikeSpecs.filter((b) => b.year === Number(specYear)).map((b) => b.make))].sort()
        : [],
    [bikeSpecs, specYear]
  );

  const filteredModels = useMemo(
    () =>
      specYear && specMake
        ? [...new Set(
            bikeSpecs
              .filter((b) => b.year === Number(specYear) && b.make === specMake)
              .map((b) => b.model)
          )].sort()
        : [],
    [bikeSpecs, specYear, specMake]
  );

  const selectedSpec = useMemo(
    () =>
      specYear && specMake && specModel
        ? bikeSpecs.find(
            (b) => b.year === Number(specYear) && b.make === specMake && b.model === specModel
          ) || null
        : null,
    [bikeSpecs, specYear, specMake, specModel]
  );

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

  // Check for saved ride plan on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const plan = JSON.parse(raw) as SavedRidePlan;
        const route = (routesData as Route[]).find((r) => r.id === plan.routeId);
        if (route) {
          setSavedPlan(plan);
          setSavedRoute(route);
        }
      }
    } catch {
      // Invalid stored data — ignore
    }
  }, []);

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

        // Store profile bikes for bike selection step
        const bikes = (profile.bikes || []) as ProfileBike[];
        setProfileBikes(bikes);

        // Compute bike range from primary bike
        const primaryBike = bikes.find((b) => b.isPrimary) || bikes[0];
        if (primaryBike) {
          const range = computeRangeKm(primaryBike);
          setRangeKm(range);
          setSelectedBike({
            make: primaryBike.make,
            model: primaryBike.model,
            tankLitres: primaryBike.tankLitres,
            consumptionPer100km: primaryBike.consumptionPer100km,
            rangeKm: range,
          });
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

  // Save ride plan to localStorage AND database when result is reached
  useEffect(() => {
    if (step === "result" && selectedRoute && rider) {
      const plan: SavedRidePlan = {
        rider: { displayName: rider.displayName, lat: rider.lat, lng: rider.lng },
        bike: selectedBike
          ? { make: selectedBike.make, model: selectedBike.model, rangeKm: selectedBike.rangeKm }
          : null,
        vibe,
        difficulty,
        routeId: selectedRoute.id,
        destinationName: selectedRoute.destinations[0]?.name || null,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));

      // Also save to database for authenticated users
      fetch("/api/solo-rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: selectedRoute.id,
          destinationName: selectedRoute.destinations[0]?.name || null,
          meetingPointId: scored?.meetingPoint?.id || null,
          vibe,
          difficulty,
          riderLat: rider.lat,
          riderLng: rider.lng,
          riderSuburb: rider.displayName,
          bikeMake: selectedBike?.make || null,
          bikeModel: selectedBike?.model || null,
          rangeKm: selectedBike?.rangeKm || null,
        }),
      }).catch(() => {
        // Silently fail — localStorage is the primary persistence
      });
    }
  }, [step, selectedRoute, rider, selectedBike, vibe, difficulty, scored]);

  const handleResumePlan = () => {
    if (!savedPlan || !savedRoute) return;
    setRider(savedPlan.rider);
    setLocationInput(savedPlan.rider.displayName);
    setVibe(savedPlan.vibe as Vibe);
    setDifficulty(savedPlan.difficulty as Difficulty);
    if (savedPlan.bike) {
      setSelectedBike({
        make: savedPlan.bike.make,
        model: savedPlan.bike.model,
        tankLitres: 0,
        consumptionPer100km: 0,
        rangeKm: savedPlan.bike.rangeKm,
      });
      setRangeKm(savedPlan.bike.rangeKm);
    }
    setSelectedRoute(savedRoute);
    computeMeetingPoint(savedRoute, savedPlan.rider);
    setSavedPlan(null);
    setSavedRoute(null);
  };

  const handleDismissSavedPlan = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedPlan(null);
    setSavedRoute(null);
  };

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
      setStep("bike");
    } else {
      setLocationError("Couldn't find that location. Try a suburb name or postcode.");
      setLocationLoading(false);
    }
  };

  const handleLocationNext = () => {
    if (rider) setStep("bike");
  };

  const handleProfileBikeSelect = (bike: ProfileBike) => {
    const range = computeRangeKm(bike);
    setSelectedBike({
      make: bike.make,
      model: bike.model,
      tankLitres: bike.tankLitres,
      consumptionPer100km: bike.consumptionPer100km,
      rangeKm: range,
    });
    setRangeKm(range);
  };

  const handleSpecBikeConfirm = () => {
    if (!selectedSpec) return;
    const range = computeRangeKm({
      tankLitres: selectedSpec.tankLitres,
      consumptionPer100km: selectedSpec.consumptionPer100km,
      isManualRange: false,
      manualRangeKm: null,
    });
    setSelectedBike({
      make: selectedSpec.make,
      model: selectedSpec.model,
      tankLitres: selectedSpec.tankLitres,
      consumptionPer100km: selectedSpec.consumptionPer100km,
      rangeKm: range,
    });
    setRangeKm(range);
    setShowSpecsSelector(false);
  };

  const handleBikeNext = () => {
    if (selectedBike) {
      trackEvent("bike_selected", { make: selectedBike.make, model: selectedBike.model });
    }
    setStep("vibe");
  };

  const handleVibeSubmit = (selectedVibe: Vibe, selectedDifficulty: Difficulty, selectedDuration?: Duration) => {
    setVibe(selectedVibe);
    setDifficulty(selectedDifficulty);
    trackEvent("vibe_selected", { vibe: selectedVibe, difficulty: selectedDifficulty, duration: selectedDuration });
    const filtered = filterRoutes(selectedVibe, selectedDifficulty, selectedDuration);
    setCandidateRoutes(filtered);
    setStep("routes");
  };

  const handleRouteSelect = (route: Route) => {
    if (!rider) return;
    setSelectedRoute(route);
    trackEvent("route_selected", { routeId: route.id, routeName: route.name });
    computeMeetingPoint(route, rider);
  };

  const handleReset = () => {
    setVibe("mix");
    setDifficulty("any");
    setCandidateRoutes([]);
    setSelectedRoute(null);
    setScored(null);
    setShowSpecsSelector(false);
    setSpecYear("");
    setSpecMake("");
    setSpecModel("");
    setStep("location");
    localStorage.removeItem(STORAGE_KEY);
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
      {/* Saved ride banner */}
      {savedPlan && savedRoute && step === "location" && (
        <div className="p-4 rounded-lg bg-[#141414] border border-[#FF6B2B]/30 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[#FF6B2B]">&#x1F4CC;</span>
            <span className="text-white font-medium text-sm">
              You have a saved ride &mdash; {savedRoute.name}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleResumePlan}
              className="flex-1 h-10 rounded-lg bg-[#FF6B2B] text-white font-semibold text-sm hover:bg-[#FF6B2B]/90 transition-colors"
            >
              Resume
            </button>
            <button
              onClick={handleDismissSavedPlan}
              className="flex-1 h-10 rounded-lg border border-[#2A2A2A] text-zinc-400 font-semibold text-sm hover:border-[#3A3A3A] transition-colors"
            >
              Start fresh
            </button>
          </div>
        </div>
      )}

      {/* Range indicator */}
      {rangeKm !== null && step !== "bike" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#141414] border border-[#2A2A2A] text-xs text-zinc-400">
          <span className="text-[#FF6B2B]">&#x26FD;</span>
          <span>Fuel range: <strong className="text-white">{Math.round(rangeKm)} km</strong></span>
          {selectedBike && (
            <span className="ml-auto text-zinc-500">{selectedBike.make} {selectedBike.model}</span>
          )}
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
                Select your bike
              </button>
            )}
          </div>
        )}

        {step === "bike" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                What are you riding?
              </h2>
              <p className="text-sm text-zinc-400">
                We&apos;ll use your bike&apos;s fuel range to plan the ride.
              </p>
            </div>

            {/* Saved bikes from profile */}
            {profileBikes.length > 0 && !showSpecsSelector && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Your bikes
                </p>
                {profileBikes.map((bike) => {
                  const bikeRange = computeRangeKm(bike);
                  const isSelected =
                    selectedBike?.make === bike.make &&
                    selectedBike?.model === bike.model &&
                    selectedBike?.rangeKm === bikeRange;
                  return (
                    <button
                      key={bike.id}
                      onClick={() => handleProfileBikeSelect(bike)}
                      className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-[#FF6B2B] bg-[#FF6B2B]/10"
                          : "border-[#2A2A2A] bg-[#141414] hover:border-[#3A3A3A]"
                      }`}
                    >
                      <div>
                        <span className="text-white font-medium text-sm">
                          {bike.make} {bike.model}
                          {bike.year ? ` (${bike.year})` : ""}
                        </span>
                        {bike.isPrimary && (
                          <span className="ml-2 text-xs text-[#FF6B2B]">Primary</span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">
                        range: {Math.round(bikeRange)} km
                      </span>
                    </button>
                  );
                })}

                <button
                  onClick={() => setShowSpecsSelector(true)}
                  className="text-sm text-[#FF6B2B] hover:underline mt-1"
                >
                  My bike isn&apos;t here
                </button>
              </div>
            )}

            {/* Cascading bike spec selector */}
            {(profileBikes.length === 0 || showSpecsSelector) && (
              <div className="space-y-3">
                {showSpecsSelector && profileBikes.length > 0 && (
                  <button
                    onClick={() => setShowSpecsSelector(false)}
                    className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to my bikes
                  </button>
                )}

                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Find your bike
                </p>

                {/* Year dropdown */}
                <select
                  value={specYear}
                  onChange={(e) => {
                    setSpecYear(e.target.value);
                    setSpecMake("");
                    setSpecModel("");
                  }}
                  className="w-full h-12 px-4 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-white focus:outline-none focus:border-[#FF6B2B] transition-colors appearance-none"
                >
                  <option value="">Year</option>
                  {uniqueYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>

                {/* Make dropdown */}
                {specYear && (
                  <select
                    value={specMake}
                    onChange={(e) => {
                      setSpecMake(e.target.value);
                      setSpecModel("");
                    }}
                    className="w-full h-12 px-4 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-white focus:outline-none focus:border-[#FF6B2B] transition-colors appearance-none"
                  >
                    <option value="">Brand</option>
                    {filteredMakes.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}

                {/* Model dropdown */}
                {specYear && specMake && (
                  <select
                    value={specModel}
                    onChange={(e) => setSpecModel(e.target.value)}
                    className="w-full h-12 px-4 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-white focus:outline-none focus:border-[#FF6B2B] transition-colors appearance-none max-h-48 overflow-y-auto"
                  >
                    <option value="">Model</option>
                    {filteredModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}

                {/* Selected spec details */}
                {selectedSpec && (
                  <div className="p-3 rounded-lg bg-[#141414] border border-[#2A2A2A] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium text-sm">
                        {selectedSpec.make} {selectedSpec.model} ({selectedSpec.year})
                      </span>
                      <span className="text-xs text-zinc-500">{selectedSpec.engineCC} cc</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      <span>Tank: {selectedSpec.tankLitres} L</span>
                      <span>Consumption: {selectedSpec.consumptionPer100km} L/100km</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#FF6B2B]">&#x26FD;</span>
                      <span className="text-sm text-white font-medium">
                        Range: {Math.round(computeRangeKm({
                          tankLitres: selectedSpec.tankLitres,
                          consumptionPer100km: selectedSpec.consumptionPer100km,
                          isManualRange: false,
                          manualRangeKm: null,
                        }))} km
                        <span className="text-xs text-zinc-500 ml-1">(with 20% safety margin)</span>
                      </span>
                    </div>
                    <button
                      onClick={handleSpecBikeConfirm}
                      className="w-full h-10 rounded-lg bg-[#FF6B2B] text-white font-semibold text-sm hover:bg-[#FF6B2B]/90 transition-colors mt-1"
                    >
                      Use this bike
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Current selection summary */}
            {selectedBike && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#141414] border border-[#FF6B2B]/30">
                <span className="text-[#FF6B2B]">&#x26FD;</span>
                <div className="flex-1">
                  <span className="text-white font-medium text-sm">
                    {selectedBike.make} {selectedBike.model}
                  </span>
                  <span className="text-xs text-zinc-400 ml-2">
                    {Math.round(selectedBike.rangeKm)} km range
                  </span>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep("location")}
                className="h-14 px-6 rounded-lg border border-[#2A2A2A] text-zinc-400 font-semibold hover:border-[#3A3A3A] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleBikeNext}
                disabled={!selectedBike}
                className="flex-1 h-14 rounded-lg bg-[#FF6B2B] text-white text-lg font-bold hover:bg-[#FF6B2B]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Choose your vibe
              </button>
            </div>
          </div>
        )}

        {step === "vibe" && (
          <VibePicker
            onSubmit={handleVibeSubmit}
            onBack={() => setStep("bike")}
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
            rangeKm={rangeKm ?? undefined}
            bikeName={selectedBike ? `${selectedBike.make} ${selectedBike.model}` : undefined}
            isSoloRide
          />
        )}
      </div>
    </div>
  );
}
