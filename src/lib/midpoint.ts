import meetingPointsData from "@/data/meetingPoints.json";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MeetingPoint {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  region: string;
  type: string;
  notes: string;
  amenities: string[];
}

export interface RiderDistance {
  displayName: string;
  distanceKm: number;
}

export interface ScoredMeetingPoint {
  meetingPoint: MeetingPoint;
  maxRiderDistanceKm: number;
  riderDistances: RiderDistance[];
  routeDetourKm: number;
}

export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Minimax meeting point selection: minimises the worst-case rider commute
 * while biasing toward meeting points near the route start.
 */
export function findOptimalMeetingPoint(
  riders: { lat: number; lng: number; displayName: string }[],
  routeStart: LatLng,
  detourWeight: number = 0.4
): ScoredMeetingPoint {
  const candidates = meetingPointsData as MeetingPoint[];
  let bestResult: ScoredMeetingPoint | null = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    const candidateLatLng = { lat: candidate.lat, lng: candidate.lng };

    const riderDistances = riders.map((r) => ({
      displayName: r.displayName,
      distanceKm: haversineDistance(r, candidateLatLng),
    }));

    const maxRiderDistanceKm = Math.max(
      ...riderDistances.map((d) => d.distanceKm)
    );
    const routeDetourKm = haversineDistance(candidateLatLng, routeStart);

    // Score: worst-case rider distance + penalised detour from route start
    const score = maxRiderDistanceKm + routeDetourKm * detourWeight;

    if (score < bestScore) {
      bestScore = score;
      bestResult = {
        meetingPoint: candidate,
        maxRiderDistanceKm,
        riderDistances,
        routeDetourKm,
      };
    }
  }

  return bestResult!;
}
