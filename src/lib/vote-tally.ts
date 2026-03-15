import type { RideVote } from "@/generated/prisma";
import { filterRoutes } from "./routeMatcher";
import type { Route, Vibe, Difficulty } from "./routeMatcher";
import { findOptimalMeetingPoint } from "./midpoint";
import type { MeetingPoint, ScoredMeetingPoint } from "./midpoint";
import { findRouteById } from "./ride-helpers";
import meetingPointsData from "@/data/meetingPoints.json";

interface TallyResult {
  winningRouteId: string;
  winningRoute: Route | null;
  winningDestination: string | null;
  routeVoteCounts: Record<string, number>;
  destinationVoteCounts: Record<string, number>;
  meetingPoint: ScoredMeetingPoint | null;
  totalVotes: number;
}

export function tallyVotes(
  votes: RideVote[],
  vibe: string | null,
  difficulty: string | null,
  creatorId: string,
  memberLocations: { lat: number; lng: number; displayName: string }[]
): TallyResult {
  if (votes.length === 0) {
    return {
      winningRouteId: "",
      winningRoute: null,
      winningDestination: null,
      routeVoteCounts: {},
      destinationVoteCounts: {},
      meetingPoint: null,
      totalVotes: 0,
    };
  }

  // Count route votes
  const routeCounts: Record<string, number> = {};
  for (const vote of votes) {
    routeCounts[vote.routeId] = (routeCounts[vote.routeId] || 0) + 1;
  }

  // Find winning route
  const maxVotes = Math.max(...Object.values(routeCounts));
  const tiedRouteIds = Object.entries(routeCounts)
    .filter(([, count]) => count === maxVotes)
    .map(([id]) => id);

  let winningRouteId: string;
  if (tiedRouteIds.length === 1) {
    winningRouteId = tiedRouteIds[0];
  } else {
    // Break tie with filterRoutes score
    const scored = filterRoutes(
      (vibe as Vibe) || "mix",
      (difficulty as Difficulty) || "any"
    );
    const scoredIds = scored.map((r) => r.id);
    const sorted = tiedRouteIds.sort(
      (a, b) => scoredIds.indexOf(a) - scoredIds.indexOf(b)
    );

    // If still tied, use creator's vote as tiebreaker
    const creatorVote = votes.find((v) => v.userId === creatorId);
    if (creatorVote && tiedRouteIds.includes(creatorVote.routeId)) {
      winningRouteId = creatorVote.routeId;
    } else {
      winningRouteId = sorted[0];
    }
  }

  const winningRoute = findRouteById(winningRouteId) || null;

  // Count destination votes for the winning route
  const destCounts: Record<string, number> = {};
  const winningRouteVotes = votes.filter((v) => v.routeId === winningRouteId);
  for (const vote of winningRouteVotes) {
    if (vote.destinationName) {
      destCounts[vote.destinationName] =
        (destCounts[vote.destinationName] || 0) + 1;
    }
  }

  // Pick winning destination
  let winningDestination: string | null = null;
  if (Object.keys(destCounts).length > 0) {
    const maxDestVotes = Math.max(...Object.values(destCounts));
    const tiedDests = Object.entries(destCounts)
      .filter(([, count]) => count === maxDestVotes)
      .map(([name]) => name);
    winningDestination = tiedDests[0];
  }

  // Calculate meeting point filtered to winning route's meetingPointIds
  let meetingPoint: ScoredMeetingPoint | null = null;
  if (winningRoute && memberLocations.length > 0) {
    const routeStart = {
      lat: winningRoute.waypoints[0].lat,
      lng: winningRoute.waypoints[0].lng,
    };

    const allMeetingPoints = meetingPointsData as MeetingPoint[];
    const routeMeetingPoints = allMeetingPoints.filter((mp) =>
      winningRoute.meetingPointIds.includes(mp.id)
    );

    // Fall back to all meeting points if route has none
    const candidates =
      routeMeetingPoints.length > 0 ? routeMeetingPoints : allMeetingPoints;

    meetingPoint = findOptimalMeetingPoint(
      memberLocations,
      routeStart,
      0.4,
      candidates
    );
  }

  return {
    winningRouteId,
    winningRoute,
    winningDestination,
    routeVoteCounts: routeCounts,
    destinationVoteCounts: destCounts,
    meetingPoint,
    totalVotes: votes.length,
  };
}
