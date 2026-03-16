import { haversineDistance } from "./midpoint";

export interface PointOfInterest {
  name: string;
  lat: number;
  lng: number;
  type: "fuel" | "medical" | "rest" | "cafe";
  notes?: string;
}

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Calculate cumulative distances along a route and flag segments
 * where fuel might be needed (default threshold: 120km).
 */
export function calculateFuelStops(
  waypoints: LatLng[],
  pois: PointOfInterest[],
  tankRangeKm: number = 120
): { fuelNeeded: boolean; maxGapKm: number; recommendedStops: PointOfInterest[] } {
  if (waypoints.length < 2) {
    return { fuelNeeded: false, maxGapKm: 0, recommendedStops: [] };
  }

  // Calculate total route distance and segment distances
  let totalDistance = 0;
  const segmentDistances: number[] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const dist = haversineDistance(waypoints[i - 1], waypoints[i]);
    segmentDistances.push(dist);
    totalDistance += dist;
  }

  const fuelStops = pois.filter((p) => p.type === "fuel");
  const maxGapKm = Math.round(totalDistance);
  const fuelNeeded = totalDistance > tankRangeKm;

  // Find fuel POIs that fall within the route corridor
  const recommendedStops = fuelStops.filter((stop) => {
    // Check if this fuel stop is within 15km of any waypoint
    return waypoints.some(
      (wp) => haversineDistance(wp, stop) < 15
    );
  });

  return { fuelNeeded, maxGapKm, recommendedStops };
}

/**
 * Find the nearest POIs of a given type to any point on the route.
 */
export function findNearestPOIs(
  waypoints: LatLng[],
  pois: PointOfInterest[],
  type: "fuel" | "medical" | "rest",
  maxDistanceKm: number = 20
): (PointOfInterest & { nearestWaypointDistKm: number })[] {
  const filtered = pois.filter((p) => p.type === type);

  return filtered
    .map((poi) => {
      const distances = waypoints.map((wp) => haversineDistance(wp, poi));
      const minDist = Math.min(...distances);
      return { ...poi, nearestWaypointDistKm: Math.round(minDist * 10) / 10 };
    })
    .filter((p) => p.nearestWaypointDistKm <= maxDistanceKm)
    .sort((a, b) => a.nearestWaypointDistKm - b.nearestWaypointDistKm);
}
