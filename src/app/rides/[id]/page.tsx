"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import HandleSearch from "@/components/HandleSearch";
import NavLinks from "@/components/NavLinks";
import PointsOfInterestSection from "@/components/PointsOfInterest";
import RouteGallery from "@/components/RouteGallery";
import { filterRoutes } from "@/lib/routeMatcher";
import type { Route, Vibe, Difficulty } from "@/lib/routeMatcher";
import type { PointOfInterest } from "@/lib/poi";
import routesData from "@/data/routes.json";
import poiData from "@/data/poi.json";

function findRouteById(routeId: string): Route | undefined {
  return (routesData as Route[]).find((r) => r.id === routeId);
}

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

interface RideMember {
  id: string;
  userId: string;
  role: string;
  startLat: number | null;
  startLng: number | null;
  user: {
    id: string;
    handle: string | null;
    displayName: string | null;
  };
}

interface RideVote {
  id: string;
  userId: string;
  routeId: string;
  destinationName: string | null;
}

interface RideDetail {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  vibe: string | null;
  difficulty: string | null;
  inviteCode: string;
  creatorId: string;
  routeId: string | null;
  destinationName: string | null;
  meetingPointId: string | null;
  members: RideMember[];
  votes: RideVote[];
  creator: {
    id: string;
    handle: string | null;
    displayName: string | null;
  };
}

interface ResultsData {
  winningRouteId: string;
  winningRoute: {
    id: string;
    name: string;
    description: string;
    vibe: string[];
    difficulty: string;
    distanceKm: number;
    durationMinutes: number;
  } | null;
  winningDestination: string | null;
  meetingPoint: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    maxRiderDistanceKm: number;
    riderDistances: { displayName: string; distanceKm: number }[];
  } | null;
  routeVoteCounts: Record<string, number>;
  destinationVoteCounts: Record<string, number>;
  totalVotes: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  VOTING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  LOCKED: "bg-[#FF6B2B]/20 text-[#FF6B2B] border-[#FF6B2B]/30",
  COMPLETED: "bg-green-500/20 text-green-400 border-green-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/20 text-red-400 border-red-500/30",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RideDetailPage() {
  const params = useParams();
  const rideId = params.id as string;

  const [ride, setRide] = useState<RideDetail | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [overrideRouteId, setOverrideRouteId] = useState("");
  const [overrideDestName, setOverrideDestName] = useState("");

  const fetchRide = useCallback(async () => {
    try {
      const res = await fetch(`/api/rides/${rideId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to load ride");
      }
      const data: RideDetail = await res.json();
      setRide(data);

      // If locked or completed, fetch results
      if (
        data.status === "LOCKED" ||
        data.status === "COMPLETED" ||
        data.status === "CANCELLED"
      ) {
        try {
          const resultsRes = await fetch(`/api/rides/${rideId}/results`);
          if (resultsRes.ok) {
            const resultsData: ResultsData = await resultsRes.json();
            setResults(resultsData);
          }
        } catch {
          // Results might not exist for cancelled rides
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ride");
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  // Fetch current user
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          if (session?.user?.id) {
            setCurrentUserId(session.user.id);
          }
        }
      } catch {
        // Ignore session fetch errors
      }
    }
    fetchSession();
  }, []);

  useEffect(() => {
    fetchRide();
  }, [fetchRide]);

  const isLeader = ride ? ride.creatorId === currentUserId : false;

  const handleAddMember = async (user: {
    id: string;
    handle: string;
    displayName: string | null;
  }) => {
    if (!ride) return;
    try {
      const res = await fetch(`/api/rides/${ride.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: user.handle }),
      });
      if (res.ok) {
        fetchRide();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to add member");
      }
    } catch {
      setError("Failed to add member");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ride) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rides/${ride.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchRide();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to update ride");
      }
    } catch {
      setError("Failed to update ride");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!ride || !overrideRouteId) return;
    setActionLoading(true);
    setError("");
    try {
      const body: Record<string, string> = { routeId: overrideRouteId };
      if (overrideDestName) {
        body.destinationName = overrideDestName;
      }
      const res = await fetch(`/api/rides/${ride.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        fetchRide();
        setOverrideRouteId("");
        setOverrideDestName("");
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to override route");
      }
    } catch {
      setError("Failed to override route");
    } finally {
      setActionLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!ride) return;
    const url = `${window.location.origin}/rides/join/${ride.inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
          Loading ride...
        </div>
      </div>
    );
  }

  if (error && !ride) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-zinc-400">{error}</p>
        <Link
          href="/rides"
          className="inline-block text-sm text-[#FF6B2B] hover:underline"
        >
          Back to rides
        </Link>
      </div>
    );
  }

  if (!ride) return null;

  // Get full route data for LOCKED/COMPLETED
  const fullRoute: Route | undefined = ride.routeId
    ? findRouteById(ride.routeId)
    : undefined;

  const selectedDestIdx = fullRoute
    ? fullRoute.destinations.findIndex(
        (d) => d.name === ride.destinationName
      )
    : 0;
  const destination =
    fullRoute?.destinations[selectedDestIdx >= 0 ? selectedDestIdx : 0];

  // Get POIs
  const routePois: PointOfInterest[] = fullRoute
    ? (poiData as Record<string, PointOfInterest[]>)[fullRoute.id] || []
    : [];

  // Available routes for override dropdown
  const overrideRoutes: Route[] =
    ride.vibe && ride.difficulty
      ? filterRoutes(ride.vibe as Vibe, ride.difficulty as Difficulty)
      : filterRoutes("mix", "any");

  // Selected override route for destination dropdown
  const overrideRouteObj = overrideRouteId
    ? findRouteById(overrideRouteId)
    : undefined;

  // Vote summary
  const votedUserIds = ride.votes.map((v) => v.userId);
  const routeVoteCounts: Record<string, number> = {};
  for (const v of ride.votes) {
    routeVoteCounts[v.routeId] = (routeVoteCounts[v.routeId] || 0) + 1;
  }

  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/rides/join/${ride.inviteCode}`;

  return (
    <div className="space-y-4 py-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/rides"
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            &larr; All rides
          </Link>
          <h2 className="text-2xl font-bold text-white mt-1">{ride.title}</h2>
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[ride.status] || "bg-zinc-500/20 text-zinc-400"}`}
        >
          {ride.status}
        </span>
      </div>

      {/* Date + vibe/difficulty badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {ride.scheduledAt && (
          <span className="text-sm text-zinc-400">
            {formatDate(ride.scheduledAt)}
          </span>
        )}
        {ride.vibe && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-[#FF6B2B]/10 text-[#FF6B2B] border border-[#FF6B2B]/20">
            {ride.vibe}
          </span>
        )}
        {ride.difficulty && (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium border ${DIFFICULTY_COLORS[ride.difficulty] || "bg-zinc-500/20 text-zinc-400"}`}
          >
            {ride.difficulty}
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* --- DRAFT VIEW --- */}
      {ride.status === "DRAFT" && (
        <>
          {/* Members */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
              Riders ({ride.members.length})
            </p>
            <div className="space-y-2">
              {ride.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center text-xs text-white font-medium">
                    {(m.user.displayName || m.user.handle || "?")[0].toUpperCase()}
                  </div>
                  <span className="text-white font-medium">
                    {m.user.displayName || m.user.handle}
                  </span>
                  {m.user.handle && (
                    <span className="text-zinc-500">@{m.user.handle}</span>
                  )}
                  {m.role === "LEADER" && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-[#FF6B2B]/10 text-[#FF6B2B]">
                      Leader
                    </span>
                  )}
                </div>
              ))}
            </div>
            {isLeader && (
              <div className="pt-2">
                <HandleSearch onSelect={handleAddMember} />
              </div>
            )}
          </div>

          {/* Invite link */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
              Invite link
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-zinc-400 text-sm truncate"
              />
              <button
                type="button"
                onClick={copyInviteLink}
                className="px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-sm text-[#FF6B2B] font-medium hover:border-[#FF6B2B] transition-colors shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Start Voting button */}
          {isLeader && (
            <button
              type="button"
              onClick={() => handleStatusChange("VOTING")}
              disabled={
                actionLoading || ride.members.length < 2 || !ride.vibe
              }
              className="w-full py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? "Updating..." : "Start Voting"}
            </button>
          )}
          {isLeader && ride.members.length < 2 && (
            <p className="text-xs text-zinc-500 text-center">
              Need at least 2 members to start voting
            </p>
          )}
          {isLeader && !ride.vibe && (
            <p className="text-xs text-zinc-500 text-center">
              Set a vibe before starting voting
            </p>
          )}
        </>
      )}

      {/* --- VOTING VIEW --- */}
      {ride.status === "VOTING" && (
        <>
          {/* Members with vote status */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
              Riders ({ride.members.length})
            </p>
            <div className="space-y-2">
              {ride.members.map((m) => {
                const hasVoted = votedUserIds.includes(m.userId);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center text-xs text-white font-medium">
                        {(m.user.displayName || m.user.handle || "?")[0].toUpperCase()}
                      </div>
                      <span className="text-white font-medium">
                        {m.user.displayName || m.user.handle}
                      </span>
                      {m.role === "LEADER" && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-[#FF6B2B]/10 text-[#FF6B2B]">
                          Leader
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${hasVoted ? "text-green-400" : "text-zinc-600"}`}
                    >
                      {hasVoted ? "\u2713 Voted" : "Waiting"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vote summary */}
          {Object.keys(routeVoteCounts).length > 0 && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                Vote Summary
              </p>
              <div className="space-y-2">
                {Object.entries(routeVoteCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([routeVoteId, count]) => {
                    const route = findRouteById(routeVoteId);
                    return (
                      <div
                        key={routeVoteId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-white">
                          {route?.name || routeVoteId}
                        </span>
                        <span className="text-zinc-400">
                          {count} vote{count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Vote CTA */}
          <Link
            href={`/rides/${ride.id}/vote`}
            className="block w-full py-3.5 bg-[#141414] border border-[#FF6B2B] text-[#FF6B2B] font-bold text-base rounded-lg text-center hover:bg-[#FF6B2B]/10 transition-colors"
          >
            {votedUserIds.includes(currentUserId ?? "")
              ? "Change Vote"
              : "Vote on Route"}
          </Link>

          {/* Invite link */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
              Invite link
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-zinc-400 text-sm truncate"
              />
              <button
                type="button"
                onClick={copyInviteLink}
                className="px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-sm text-[#FF6B2B] font-medium hover:border-[#FF6B2B] transition-colors shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Lock Ride button */}
          {isLeader && (
            <button
              type="button"
              onClick={() => handleStatusChange("LOCKED")}
              disabled={actionLoading || ride.votes.length < 1}
              className="w-full py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? "Locking..." : "Lock Ride"}
            </button>
          )}
          {isLeader && ride.votes.length < 1 && (
            <p className="text-xs text-zinc-500 text-center">
              Need at least 1 vote to lock the ride
            </p>
          )}
        </>
      )}

      {/* --- LOCKED VIEW --- */}
      {(ride.status === "LOCKED" ||
        ride.status === "COMPLETED" ||
        ride.status === "CANCELLED") && (
        <>
          {/* Status banner for completed/cancelled */}
          {ride.status === "COMPLETED" && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
              <p className="text-sm text-green-400 font-medium">
                Ride completed
              </p>
            </div>
          )}
          {ride.status === "CANCELLED" && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
              <p className="text-sm text-red-400 font-medium">
                Ride cancelled
              </p>
            </div>
          )}

          {/* Meeting point */}
          {results?.meetingPoint && (
            <div className="p-4 rounded-lg bg-[#141414] border border-[#2A2A2A]">
              <p className="text-xs text-[#FF6B2B] font-semibold uppercase tracking-wider mb-1">
                Meeting Point
              </p>
              <h3 className="text-lg font-bold text-white">
                {results.meetingPoint.name}
              </h3>
              <p className="text-sm text-zinc-400 mt-0.5">
                {results.meetingPoint.address}
              </p>
              {results.meetingPoint.riderDistances.length > 0 && (
                <div className="mt-3 space-y-1">
                  {results.meetingPoint.riderDistances.map((rd, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-400">{rd.displayName}</span>
                      <span className="text-zinc-600">&mdash;</span>
                      <span className="text-zinc-500">
                        ~{Math.round(rd.distanceKm)} km
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${results.meetingPoint.lat},${results.meetingPoint.lng}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#FF6B2B] font-medium hover:underline"
              >
                Navigate here &rarr;
              </a>
            </div>
          )}

          {/* Route details */}
          {fullRoute && (
            <div className="p-4 rounded-lg bg-[#141414] border border-[#2A2A2A] space-y-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {fullRoute.name}
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {fullRoute.description}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${DIFFICULTY_COLORS[fullRoute.difficulty] || "bg-zinc-500/20 text-zinc-400"}`}
                >
                  {fullRoute.difficulty}
                </span>
                <span className="text-xs text-zinc-500">
                  {fullRoute.distanceKm} km
                </span>
                <span className="text-xs text-zinc-500">&middot;</span>
                <span className="text-xs text-zinc-500">
                  ~{Math.round(fullRoute.durationMinutes / 60)}h{" "}
                  {fullRoute.durationMinutes % 60}m
                </span>
              </div>
              {fullRoute.highlights.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {fullRoute.highlights.map((h) => (
                    <span
                      key={h}
                      className="px-2 py-0.5 rounded-full text-xs bg-[#FF6B2B]/10 text-[#FF6B2B] border border-[#FF6B2B]/20"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              )}
              {fullRoute.warnings.length > 0 && (
                <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                  <p className="text-xs text-yellow-400/80">
                    {fullRoute.warnings.join(" \u2022 ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Destination info */}
          {destination && (
            <div className="p-4 rounded-lg bg-[#141414] border border-[#2A2A2A]">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">
                Destination
              </p>
              <h3 className="text-white font-bold">{destination.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                <span>{destination.type}</span>
                <span>&middot;</span>
                <span>
                  {destination.position === "enroute"
                    ? "Along route"
                    : "End point"}
                </span>
              </div>
            </div>
          )}

          {/* Map */}
          {fullRoute && results?.meetingPoint && destination && (() => {
            const rideMapLegs = [
              {
                polyline: [
                  [results.meetingPoint.lat, results.meetingPoint.lng] as [number, number],
                  ...fullRoute.waypoints.map((wp): [number, number] => [wp.lat, wp.lng]),
                ],
                style: "solid-orange" as const,
              },
              {
                polyline: [
                  [fullRoute.waypoints[fullRoute.waypoints.length - 1].lat, fullRoute.waypoints[fullRoute.waypoints.length - 1].lng] as [number, number],
                  [destination.lat, destination.lng] as [number, number],
                ],
                style: "dashed-orange" as const,
              },
              ...ride.members
                .filter((m) => m.startLat !== null && m.startLng !== null)
                .map((m) => ({
                  polyline: [
                    [m.startLat as number, m.startLng as number] as [number, number],
                    [results.meetingPoint!.lat, results.meetingPoint!.lng] as [number, number],
                  ],
                  style: "dashed-rider" as const,
                  color: "#FF6B2B",
                })),
            ];
            const rideMapMarkers = [
              {
                position: [results.meetingPoint.lat, results.meetingPoint.lng] as [number, number],
                type: "start" as const,
                label: results.meetingPoint.name,
              },
              ...fullRoute.waypoints.map((wp) => ({
                position: [wp.lat, wp.lng] as [number, number],
                type: "waypoint" as const,
                label: wp.label,
              })),
              {
                position: [destination.lat, destination.lng] as [number, number],
                type: "destination" as const,
                label: destination.name,
              },
              ...ride.members
                .filter((m) => m.startLat !== null && m.startLng !== null)
                .map((m) => ({
                  position: [m.startLat as number, m.startLng as number] as [number, number],
                  type: "rider" as const,
                  label: m.user.displayName || m.user.handle || "Rider",
                  color: "#FF6B2B",
                })),
              ...routePois.map((poi) => ({
                position: [poi.lat, poi.lng] as [number, number],
                type: (poi.type === "fuel" ? "fuel" : poi.type === "medical" ? "medical" : "cafe") as "fuel" | "medical" | "cafe",
                label: poi.name,
              })),
            ];
            return (
              <Map
                legs={rideMapLegs}
                markers={rideMapMarkers}
              />
            );
          })()}

          {/* Route photos */}
          {fullRoute && <RouteGallery routeId={fullRoute.id} />}

          {/* POIs */}
          {routePois.length > 0 && fullRoute && (
            <PointsOfInterestSection
              pois={routePois}
              routeDistanceKm={fullRoute.distanceKm}
            />
          )}

          {/* Nav links */}
          {fullRoute && results?.meetingPoint && destination && (
            <NavLinks
              meetingPoint={{
                lat: results.meetingPoint.lat,
                lng: results.meetingPoint.lng,
              }}
              waypoints={fullRoute.waypoints.map((wp) => ({
                lat: wp.lat,
                lng: wp.lng,
              }))}
              destination={{
                lat: destination.lat,
                lng: destination.lng,
              }}
            />
          )}

          {/* Leader override controls (LOCKED only) */}
          {isLeader && ride.status === "LOCKED" && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                Leader Override
              </p>
              <div>
                <label className="block text-xs text-[#999999] mb-1">
                  Change route
                </label>
                <select
                  value={overrideRouteId}
                  onChange={(e) => {
                    setOverrideRouteId(e.target.value);
                    setOverrideDestName("");
                  }}
                  className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white text-sm focus:outline-none focus:border-[#FF6B2B] transition-colors"
                >
                  <option value="">Select a route...</option>
                  {overrideRoutes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              {overrideRouteObj && (
                <div>
                  <label className="block text-xs text-[#999999] mb-1">
                    Change destination
                  </label>
                  <select
                    value={overrideDestName}
                    onChange={(e) => setOverrideDestName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white text-sm focus:outline-none focus:border-[#FF6B2B] transition-colors"
                  >
                    <option value="">Default destination</option>
                    {overrideRouteObj.destinations.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={handleOverride}
                disabled={actionLoading || !overrideRouteId}
                className="w-full py-2.5 bg-[#0A0A0A] border border-[#FF6B2B] text-[#FF6B2B] font-bold text-sm rounded-lg hover:bg-[#FF6B2B]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading ? "Updating..." : "Apply Override"}
              </button>
            </div>
          )}

          {/* Mark Complete / Cancel (LOCKED only) */}
          {isLeader && ride.status === "LOCKED" && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleStatusChange("COMPLETED")}
                disabled={actionLoading}
                className="flex-1 py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Mark Complete
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange("CANCELLED")}
                disabled={actionLoading}
                className="py-3.5 px-6 bg-[#0A0A0A] border border-[#2A2A2A] text-zinc-400 font-semibold text-base rounded-lg hover:border-red-500/50 hover:text-red-400 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      {/* Members list for LOCKED/COMPLETED/CANCELLED */}
      {(ride.status === "LOCKED" ||
        ride.status === "COMPLETED" ||
        ride.status === "CANCELLED") && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
            Riders ({ride.members.length})
          </p>
          <div className="space-y-2">
            {ride.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center text-xs text-white font-medium">
                  {(m.user.displayName || m.user.handle || "?")[0].toUpperCase()}
                </div>
                <span className="text-white font-medium">
                  {m.user.displayName || m.user.handle}
                </span>
                {m.role === "LEADER" && (
                  <span className="px-1.5 py-0.5 rounded text-xs bg-[#FF6B2B]/10 text-[#FF6B2B]">
                    Leader
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
