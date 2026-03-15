"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { filterRoutes } from "@/lib/routeMatcher";
import type { Route, Vibe, Difficulty } from "@/lib/routeMatcher";
import RouteGallery from "@/components/RouteGallery";

interface RideBasic {
  id: string;
  title: string;
  status: string;
  vibe: string | null;
  difficulty: string | null;
}

interface ExistingVote {
  routeId: string;
  destinationName: string | null;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
  const rideId = params.id as string;

  const [ride, setRide] = useState<RideBasic | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [existingVote, setExistingVote] = useState<ExistingVote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchRide() {
      try {
        const res = await fetch(`/api/rides/${rideId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to load ride");
        }
        const data = await res.json();
        setRide(data);

        if (data.status !== "VOTING") {
          setError("Voting is not currently open for this ride.");
          setLoading(false);
          return;
        }

        // Get candidate routes
        const vibe = (data.vibe as Vibe) || "mix";
        const difficulty = (data.difficulty as Difficulty) || "any";
        const candidates = filterRoutes(vibe, difficulty);
        setRoutes(candidates);

        // Check for existing vote from current user
        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          const session = await sessionRes.json();
          if (session?.user?.id) {
            const myVote = data.votes?.find(
              (v: { userId: string }) => v.userId === session.user.id
            );
            if (myVote) {
              setExistingVote({
                routeId: myVote.routeId,
                destinationName: myVote.destinationName,
              });
              setSelectedRoute(myVote.routeId);
              setSelectedDest(myVote.destinationName || null);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ride");
      } finally {
        setLoading(false);
      }
    }
    fetchRide();
  }, [rideId]);

  const handleRouteClick = (routeId: string) => {
    if (expandedRouteId === routeId) {
      setExpandedRouteId(null);
    } else {
      setExpandedRouteId(routeId);
      setSelectedRoute(routeId);
      setSelectedDest(null);
    }
  };

  const handleSubmitVote = async () => {
    if (!selectedRoute) {
      setError("Please select a route");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const body: Record<string, string> = { routeId: selectedRoute };
      if (selectedDest) {
        body.destinationName = selectedDest;
      }

      const res = await fetch(`/api/rides/${rideId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit vote");
      }

      router.push(`/rides/${rideId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit vote");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
          Loading...
        </div>
      </div>
    );
  }

  if (error && !ride) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-zinc-400">{error}</p>
        <Link
          href={`/rides/${rideId}`}
          className="inline-block text-sm text-[#FF6B2B] hover:underline"
        >
          Back to ride
        </Link>
      </div>
    );
  }

  if (ride && ride.status !== "VOTING") {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-zinc-400">
          Voting is not currently open for this ride.
        </p>
        <Link
          href={`/rides/${rideId}`}
          className="inline-block text-sm text-[#FF6B2B] hover:underline"
        >
          Back to ride
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div>
        <Link
          href={`/rides/${rideId}`}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          &larr; Back to ride
        </Link>
        <h2 className="text-2xl font-bold text-white mt-1">
          Vote: {ride?.title}
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          {routes.length} route{routes.length !== 1 ? "s" : ""} matched. Pick
          your favourite.
        </p>
      </div>

      {existingVote && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-400">
            You already voted. Your selection is highlighted below. Change it or
            confirm.
          </p>
        </div>
      )}

      {routes.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-lg text-white mb-2">No routes match</p>
          <p className="text-zinc-400">
            This ride&apos;s vibe/difficulty combo has no matching routes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => {
            const isExpanded = expandedRouteId === route.id;
            const isSelected = selectedRoute === route.id;

            return (
              <div key={route.id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleRouteClick(route.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-all space-y-2 ${
                    isSelected
                      ? "border-[#FF6B2B] bg-[#FF6B2B]/5"
                      : "bg-[#141414] border-[#2A2A2A] hover:border-[#3A3A3A]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-white font-bold">{route.name}</h3>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${
                        DIFFICULTY_COLORS[route.difficulty] ||
                        "bg-zinc-500/20 text-zinc-400"
                      }`}
                    >
                      {route.difficulty}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-2">
                    {route.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>{route.distanceKm} km</span>
                    <span>&middot;</span>
                    <span>
                      ~{Math.round(route.durationMinutes / 60)}h{" "}
                      {route.durationMinutes % 60}m
                    </span>
                    <span>&middot;</span>
                    <span>{route.vibe.join(", ")}</span>
                  </div>
                  {route.highlights.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {route.highlights.slice(0, 3).map((h) => (
                        <span
                          key={h}
                          className="px-2 py-0.5 rounded-full text-xs bg-[#FF6B2B]/10 text-[#FF6B2B]/80"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                </button>

                {/* Expanded preview with destinations */}
                {isExpanded && (
                  <div className="space-y-3 px-1">
                    <RouteGallery routeId={route.id} />

                    {route.warnings.length > 0 && (
                      <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                        <p className="text-xs text-yellow-400/80">
                          {route.warnings.join(" \u2022 ")}
                        </p>
                      </div>
                    )}

                    {/* Destination selector */}
                    {route.destinations.length > 1 && (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                          Pick a destination (optional)
                        </p>
                        {route.destinations.map((dest) => (
                          <button
                            key={dest.name}
                            type="button"
                            onClick={() =>
                              setSelectedDest(
                                selectedDest === dest.name ? null : dest.name
                              )
                            }
                            className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                              selectedDest === dest.name
                                ? "border-[#FF6B2B] bg-[#FF6B2B]/10"
                                : "border-[#2A2A2A] bg-[#141414] hover:border-[#3A3A3A]"
                            }`}
                          >
                            <div>
                              <span className="text-white font-medium text-sm">
                                {dest.name}
                              </span>
                              <span className="text-xs text-zinc-500 ml-2">
                                {dest.position === "enroute"
                                  ? "Along route"
                                  : "End point"}
                              </span>
                            </div>
                            <span className="text-xs text-zinc-500">
                              {dest.type}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Link
          href={`/rides/${rideId}`}
          className="h-12 px-6 rounded-lg border border-[#2A2A2A] text-zinc-400 font-semibold hover:border-[#3A3A3A] transition-colors flex items-center"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={handleSubmitVote}
          disabled={submitting || !selectedRoute}
          className="flex-1 h-12 rounded-lg bg-[#FF6B2B] text-white text-lg font-bold hover:bg-[#FF6B2B]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? "Submitting..."
            : existingVote
              ? "Update Vote"
              : "Submit Vote"}
        </button>
      </div>
    </div>
  );
}
