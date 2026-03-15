import { haversineDistance } from "./midpoint";
import type { PointOfInterest } from "./poi";
import poiData from "@/data/poi.json";

interface LatLng {
  lat: number;
  lng: number;
}

interface FuelStop {
  poi: PointOfInterest;
  distanceFromStartKm: number;
  distanceFromPrevStopKm: number;
  estimatedFuelRemaining: number; // percentage (0-100)
}

interface FuelPlan {
  stops: FuelStop[];
  totalDistanceKm: number;
  rangeKm: number;
  needsFuelStops: boolean;
  arrivalFuelPercent: number; // fuel % at destination without stops
}

/**
 * Plan fuel stops along a route, Tesla-style.
 *
 * Strategy:
 * - Never let fuel drop below 20% of tank
 * - Plan a stop when the next segment would bring fuel below 20%
 * - Prefer fuel stops that are on-route or within 5-10 min detour
 * - Show rider estimated fuel % at each stop
 *
 * @param routeId - curated route ID (to look up POIs)
 * @param waypoints - ordered route points (meeting point → waypoints → destination)
 * @param rangeKm - bike's safe fuel range (already includes 20% safety margin from computeRangeKm)
 */
export function planFuelStops(
  routeId: string,
  waypoints: LatLng[],
  rangeKm: number
): FuelPlan {
  if (waypoints.length < 2) {
    return { stops: [], totalDistanceKm: 0, rangeKm, needsFuelStops: false, arrivalFuelPercent: 100 };
  }

  // Get fuel POIs for this route
  const routePois = (poiData as Record<string, PointOfInterest[]>)[routeId] || [];
  const fuelStations = routePois.filter((p) => p.type === "fuel");

  // Calculate cumulative distances along the route
  const segmentDistances: number[] = [];
  let totalDistanceKm = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const dist = haversineDistance(waypoints[i - 1], waypoints[i]);
    segmentDistances.push(dist);
    totalDistanceKm += dist;
  }

  // If total distance is within range, no stops needed
  // But check if we'd arrive with less than 20% fuel
  const arrivalFuelPercent = Math.max(0, ((rangeKm - totalDistanceKm) / rangeKm) * 100);

  if (totalDistanceKm <= rangeKm * 0.8) {
    // Comfortable — arrive with 20%+ fuel
    return {
      stops: [],
      totalDistanceKm: Math.round(totalDistanceKm),
      rangeKm,
      needsFuelStops: false,
      arrivalFuelPercent: Math.round(arrivalFuelPercent),
    };
  }

  // Need fuel stops. Calculate where each fuel station is along the route.
  const stationsWithDistance = fuelStations.map((station) => {
    // Find the nearest point on the route to this station
    let minDist = Infinity;
    let cumulativeDist = 0;
    let nearestCumulativeDist = 0;

    for (let i = 0; i < waypoints.length; i++) {
      const dist = haversineDistance(waypoints[i], station);
      if (dist < minDist) {
        minDist = dist;
        nearestCumulativeDist = cumulativeDist;
      }
      if (i < segmentDistances.length) {
        cumulativeDist += segmentDistances[i];
      }
    }

    return {
      station,
      distanceFromRoute: minDist,
      distanceAlongRoute: nearestCumulativeDist,
    };
  })
    // Only consider stations within 10km of the route
    .filter((s) => s.distanceFromRoute < 10)
    .sort((a, b) => a.distanceAlongRoute - b.distanceAlongRoute);

  // Plan stops greedily: fill up before you'd drop below 20%
  const stops: FuelStop[] = [];
  let fuelRemainingKm = rangeKm; // Start with a full tank
  let lastStopDistanceKm = 0;
  const minFuelThreshold = rangeKm * 0.2; // 20% of range

  for (const candidate of stationsWithDistance) {
    const distFromLastStop = candidate.distanceAlongRoute - lastStopDistanceKm;

    // Would we drop below 20% before reaching this station?
    // Check if any FUTURE segment after this candidate would require us to stop here
    const distToEnd = totalDistanceKm - candidate.distanceAlongRoute;
    const fuelAtStation = fuelRemainingKm - distFromLastStop;

    // Find the next candidate after this one
    const nextCandidateIdx = stationsWithDistance.indexOf(candidate) + 1;
    const nextCandidate = stationsWithDistance[nextCandidateIdx];
    const distToNextStop = nextCandidate
      ? nextCandidate.distanceAlongRoute - candidate.distanceAlongRoute
      : distToEnd;

    // Stop here if:
    // 1. We wouldn't make it to the next stop with 20% remaining, OR
    // 2. We wouldn't make it to the destination with 20% remaining
    const fuelAfterNextLeg = fuelAtStation - distToNextStop;
    const wouldMakeDestination = fuelRemainingKm - (totalDistanceKm - lastStopDistanceKm) >= minFuelThreshold;

    if (!wouldMakeDestination && fuelAtStation > 0 && fuelAfterNextLeg < minFuelThreshold) {
      stops.push({
        poi: candidate.station,
        distanceFromStartKm: Math.round(candidate.distanceAlongRoute),
        distanceFromPrevStopKm: Math.round(distFromLastStop),
        estimatedFuelRemaining: Math.round(Math.max(0, (fuelAtStation / rangeKm) * 100)),
      });

      // Refuel — back to full range
      fuelRemainingKm = rangeKm;
      lastStopDistanceKm = candidate.distanceAlongRoute;
    }
  }

  // If we still wouldn't make it and found no suitable stops, flag all fuel stations as recommended
  const finalFuelKm = fuelRemainingKm - (totalDistanceKm - lastStopDistanceKm);
  if (finalFuelKm < minFuelThreshold && stops.length === 0 && stationsWithDistance.length > 0) {
    // Pick the best station (roughly at the halfway point of remaining distance)
    const midpoint = totalDistanceKm / 2;
    const bestStation = stationsWithDistance.reduce((best, s) =>
      Math.abs(s.distanceAlongRoute - midpoint) < Math.abs(best.distanceAlongRoute - midpoint)
        ? s
        : best
    );

    stops.push({
      poi: bestStation.station,
      distanceFromStartKm: Math.round(bestStation.distanceAlongRoute),
      distanceFromPrevStopKm: Math.round(bestStation.distanceAlongRoute),
      estimatedFuelRemaining: Math.round(
        Math.max(0, ((rangeKm - bestStation.distanceAlongRoute) / rangeKm) * 100)
      ),
    });
  }

  return {
    stops,
    totalDistanceKm: Math.round(totalDistanceKm),
    rangeKm,
    needsFuelStops: stops.length > 0 || totalDistanceKm > rangeKm * 0.8,
    arrivalFuelPercent: stops.length > 0
      ? Math.round(((rangeKm - (totalDistanceKm - (stops[stops.length - 1]?.distanceFromStartKm || 0))) / rangeKm) * 100)
      : Math.round(arrivalFuelPercent),
  };
}
