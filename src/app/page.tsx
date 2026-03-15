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
import routesData from "@/data/routes.json";

type Step = "riders" | "vibe" | "routes" | "loading" | "result";

const STEPS: { key: Step; label: string }[] = [
  { key: "riders", label: "Riders" },
  { key: "vibe", label: "Vibe" },
  { key: "routes", label: "Route" },
  { key: "result", label: "Plan" },
];

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-zinc-500">Loading...</div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("riders");
  const [riders, setRiders] = useState<RiderLocation[]>([]);
  const [vibe, setVibe] = useState<Vibe>("mix");
  const [difficulty, setDifficulty] = useState<Difficulty>("any");
  const [candidateRoutes, setCandidateRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [scored, setScored] = useState<ScoredMeetingPoint | null>(null);

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

  // Check for shared URL on mount
  useEffect(() => {
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
  }, [searchParams, computeMeetingPoint]);

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
    (s) =>
      s.key === (step === "loading" ? "result" : step)
  );

  return (
    <div className="space-y-6">
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
          <RiderInput onNext={handleRidersNext} initialRiders={riders} />
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
