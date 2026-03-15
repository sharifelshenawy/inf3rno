"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import RiderInput from "@/components/RiderInput";
import type { RiderLocation } from "@/components/RiderInput";
import VibePicker from "@/components/VibePicker";
import RouteSelector from "@/components/RouteSelector";
import RouteResult from "@/components/RouteResult";
import { findOptimalMeetingPoint } from "@/lib/midpoint";
import type { ScoredMeetingPoint } from "@/lib/midpoint";
import { filterRoutes } from "@/lib/routeMatcher";
import type { Route, Vibe, Difficulty } from "@/lib/routeMatcher";
import { decodeRidePlan } from "@/lib/shareUrl";
import { computeRangeKm } from "@/lib/types";
import routesData from "@/data/routes.json";

type Step = "riders" | "vibe" | "routes" | "loading" | "result";

const STEPS: { key: Step; label: string }[] = [
  { key: "riders", label: "Riders" },
  { key: "vibe", label: "Vibe" },
  { key: "routes", label: "Route" },
  { key: "result", label: "Plan" },
];

interface ProfileData {
  suburb?: string | null;
  suburbLat?: number | null;
  suburbLng?: number | null;
  displayName?: string | null;
  handle?: string | null;
  bike?: {
    tankLitres: number;
    consumptionPer100km: number;
    isManualRange: boolean;
    manualRangeKm: number | null;
  } | null;
}

export default function AuthenticatedPlan() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-zinc-500">Loading...</div>
      }
    >
      <AuthenticatedPlanContent />
    </Suspense>
  );
}

function AuthenticatedPlanContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("riders");
  const [riders, setRiders] = useState<RiderLocation[]>([]);
  const [vibe, setVibe] = useState<Vibe>("mix");
  const [difficulty, setDifficulty] = useState<Difficulty>("any");
  const [candidateRoutes, setCandidateRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [scored, setScored] = useState<ScoredMeetingPoint | null>(null);
  const [rangeKm, setRangeKm] = useState<number | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const computeMeetingPoint = useCallback(
    (route: Route, riderList: RiderLocation[]) => {
      setStep("loading");
      setTimeout(() => {
        const routeStart = {
          lat: route.waypoints[0].lat,
          lng: route.waypoints[0].lng,
        };
        const result = findOptimalMeetingPoint(riderList, routeStart);
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
        const profile: ProfileData = await res.json();

        if (cancelled) return;

        // Auto-add user's suburb as first rider
        if (profile.suburb && profile.suburbLat && profile.suburbLng) {
          const displayName = profile.displayName || profile.handle || "You";
          setRiders((prev) => {
            // Only add if riders list is empty (don't overwrite shared URL state)
            if (prev.length > 0) return prev;
            return [
              {
                displayName,
                lat: profile.suburbLat as number,
                lng: profile.suburbLng as number,
              },
            ];
          });
        }

        // Compute bike range
        if (profile.bike) {
          const range = computeRangeKm(profile.bike);
          setRangeKm(range);
        }
      } catch {
        // Silently fail — user can still use the planner manually
      } finally {
        if (!cancelled) {
          setProfileLoaded(true);
        }
      }
    }

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  // Check for shared URL on mount (after profile loaded)
  useEffect(() => {
    if (!profileLoaded) return;

    const plan = decodeRidePlan(searchParams);
    if (plan) {
      setRiders(plan.riders);
      setVibe(plan.vibe);
      setDifficulty(plan.difficulty);

      if (plan.routeId) {
        const route = (routesData as Route[]).find(
          (r) => r.id === plan.routeId
        );
        if (route) {
          setSelectedRoute(route);
          computeMeetingPoint(route, plan.riders);
          return;
        }
      }

      // Fallback: auto-filter routes
      const filtered = filterRoutes(plan.vibe, plan.difficulty);
      if (filtered.length > 0) {
        setSelectedRoute(filtered[0]);
        computeMeetingPoint(filtered[0], plan.riders);
      }
    }
  }, [searchParams, computeMeetingPoint, profileLoaded]);

  const handleRidersNext = (riderList: RiderLocation[]) => {
    setRiders(riderList);
    setStep("vibe");
  };

  const handleVibeSubmit = (
    selectedVibe: Vibe,
    selectedDifficulty: Difficulty
  ) => {
    setVibe(selectedVibe);
    setDifficulty(selectedDifficulty);
    const filtered = filterRoutes(selectedVibe, selectedDifficulty);
    setCandidateRoutes(filtered);
    setStep("routes");
  };

  const handleRouteSelect = (route: Route) => {
    setSelectedRoute(route);
    computeMeetingPoint(route, riders);
  };

  const handleReset = () => {
    setRiders([]);
    setVibe("mix");
    setDifficulty("any");
    setCandidateRoutes([]);
    setSelectedRoute(null);
    setScored(null);
    setStep("riders");
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
          <svg className="w-4 h-4 text-[#FF6B2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
          </svg>
          <span>Bike range: <strong className="text-white">{Math.round(rangeKm)} km</strong></span>
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
        {step === "riders" && (
          <RiderInput onNext={handleRidersNext} initialRiders={riders} minRiders={1} />
        )}

        {step === "vibe" && (
          <VibePicker
            onSubmit={handleVibeSubmit}
            onBack={() => setStep("riders")}
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
            <svg
              className="animate-spin h-10 w-10 text-[#FF6B2B]"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-zinc-400 text-sm">
              Finding your perfect ride...
            </p>
          </div>
        )}

        {step === "result" && selectedRoute && scored && (
          <RouteResult
            route={selectedRoute}
            scored={scored}
            riders={riders}
            vibe={vibe}
            difficulty={difficulty}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
