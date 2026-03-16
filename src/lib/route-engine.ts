import routesData from "@/data/routes.json";
import type { Route, RouteDestination } from "./routeMatcher";
import { haversineDistance } from "./midpoint";

interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteLeg {
  type: "commute" | "approach" | "route" | "destination";
  label: string;
  polyline?: [number, number][];
  polylineUrl?: string;
  distanceKm: number;
  durationMinutes: number;
  style: "dashed-rider" | "solid-orange" | "dashed-orange";
}

export interface RoutePlan {
  routeId: string;
  direction: "forward" | "reverse";
  legs: RouteLeg[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  googleMapsUrl: string;
  wazeUrl: string;
  appleMapsUrl: string;
  suggestReverse: boolean;
  reverseReason?: string;
}

interface DirectionSuggestion {
  direction: "forward" | "reverse";
  suggestReverse: boolean;
  reverseReason?: string;
}

/**
 * The minimum distance (metres) between route end and destination
 * before a destination leg is generated.
 */
const DESTINATION_THRESHOLD_M = 200;

/**
 * Threshold ratio: if user is >20% closer to the route end than the
 * start, we suggest riding in reverse.
 */
const REVERSE_THRESHOLD = 0.20;

/**
 * Look up a route by id from the curated routes data.
 */
export function getRouteById(routeId: string): Route | undefined {
  return (routesData as Route[]).find((r) => r.id === routeId);
}

/**
 * Determine the best direction for a ride based on user location.
 *
 * Returns "forward" or "reverse" with an explanation if reverse is
 * suggested. A reverse suggestion fires when the user is >20% closer
 * to the route end than the route start (by haversine distance).
 */
export function suggestDirection(
  userLocation: LatLng,
  route: Route
): DirectionSuggestion {
  const waypoints = route.waypoints;
  if (waypoints.length < 2) {
    return { direction: "forward", suggestReverse: false };
  }

  const routeStart: LatLng = {
    lat: waypoints[0].lat,
    lng: waypoints[0].lng,
  };
  const routeEnd: LatLng = {
    lat: waypoints[waypoints.length - 1].lat,
    lng: waypoints[waypoints.length - 1].lng,
  };

  const distToStart = haversineDistance(userLocation, routeStart);
  const distToEnd = haversineDistance(userLocation, routeEnd);

  // Suggest reverse when user is >20% closer to the end than the start
  const ratio = (distToStart - distToEnd) / distToStart;

  if (ratio > REVERSE_THRESHOLD) {
    return {
      direction: "reverse",
      suggestReverse: true,
      reverseReason:
        `You're ${Math.round(distToEnd)}km from the route end vs ` +
        `${Math.round(distToStart)}km from the start — riding in reverse ` +
        `saves ${Math.round(distToStart - distToEnd)}km of commute.`,
    };
  }

  return { direction: "forward", suggestReverse: false };
}

/**
 * Get the effective start and end points for a route given a direction.
 * Forward: first waypoint is start, last is end.
 * Reverse: last waypoint is start, first is end.
 */
function getRouteEndpoints(
  route: Route,
  direction: "forward" | "reverse"
): { start: LatLng; end: LatLng } {
  const waypoints = route.waypoints;
  const first: LatLng = { lat: waypoints[0].lat, lng: waypoints[0].lng };
  const last: LatLng = {
    lat: waypoints[waypoints.length - 1].lat,
    lng: waypoints[waypoints.length - 1].lng,
  };

  return direction === "forward"
    ? { start: first, end: last }
    : { start: last, end: first };
}

/**
 * Find a destination by name within a route's destination list.
 * Falls back to the first "endpoint" destination if no name matches.
 */
function resolveDestination(
  route: Route,
  destinationName?: string
): RouteDestination | undefined {
  if (destinationName) {
    const exact = route.destinations.find(
      (d) => d.name.toLowerCase() === destinationName.toLowerCase()
    );
    if (exact) return exact;
  }

  // Fall back to first endpoint destination
  return route.destinations.find((d) => d.position === "endpoint");
}

/**
 * Estimate driving distance and duration between two points.
 * Uses haversine distance with a road-factor multiplier (roads are
 * ~30% longer than straight-line in hilly terrain like the Yarra Ranges).
 */
function estimateDriving(from: LatLng, to: LatLng): {
  distanceKm: number;
  durationMinutes: number;
} {
  const straightLine = haversineDistance(from, to);
  const roadFactor = 1.3;
  const distanceKm = Math.round(straightLine * roadFactor * 10) / 10;
  // Assume 60 km/h average for motorcycle commuting in semi-urban/rural
  const durationMinutes = Math.round((distanceKm / 60) * 60);
  return { distanceKm, durationMinutes };
}

/**
 * Sample evenly-spaced waypoints from a polyline for use in nav app URLs.
 * Google Maps allows max 25 total stops (origin + destination + 23 waypoints).
 */
export function sampleWaypointsForGoogleMaps(
  polyline: [number, number][],
  maxPoints: number = 23
): [number, number][] {
  if (polyline.length <= maxPoints) {
    return [...polyline];
  }

  const step = Math.max(1, Math.floor(polyline.length / maxPoints));
  const sampled: [number, number][] = [];

  for (let i = 0; i < polyline.length && sampled.length < maxPoints; i += step) {
    sampled.push(polyline[i]);
  }

  // Always include the last point
  const last = polyline[polyline.length - 1];
  if (
    sampled.length > 0 &&
    (sampled[sampled.length - 1][0] !== last[0] ||
      sampled[sampled.length - 1][1] !== last[1])
  ) {
    if (sampled.length >= maxPoints) {
      sampled[sampled.length - 1] = last;
    } else {
      sampled.push(last);
    }
  }

  return sampled;
}

/**
 * Generate navigation app URLs using route waypoints from the curated
 * route data. These are approximate — the client-side nav-url-builder
 * produces more accurate URLs once the full CDN polyline is loaded.
 */
export function generateNavUrls(
  route: Route,
  direction: "forward" | "reverse",
  userLocation: LatLng,
  destination?: LatLng
): { googleMapsUrl: string; wazeUrl: string; appleMapsUrl: string } {
  const { start, end } = getRouteEndpoints(route, direction);
  const finalDest = destination ?? end;

  // Build waypoints from route data in the correct direction order
  const routeWaypoints =
    direction === "forward"
      ? route.waypoints
      : [...route.waypoints].reverse();

  const waypointCoords: [number, number][] = routeWaypoints.map((wp) => [
    wp.lat,
    wp.lng,
  ]);

  // Sample for Google Maps (max 23 waypoints)
  const sampled = sampleWaypointsForGoogleMaps(waypointCoords, 23);
  const waypointsStr = sampled
    .map(([lat, lng]) => `${lat},${lng}`)
    .join("|");

  const googleMapsUrl =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${userLocation.lat},${userLocation.lng}` +
    `&destination=${finalDest.lat},${finalDest.lng}` +
    `&waypoints=${waypointsStr}` +
    `&travelmode=driving`;

  // Waze: navigate to route start (single destination only)
  const wazeUrl =
    `https://waze.com/ul?ll=${start.lat},${start.lng}` +
    `&navigate=yes&from=${userLocation.lat},${userLocation.lng}`;

  // Apple Maps: chained waypoints
  const appleSampled = sampleWaypointsForGoogleMaps(waypointCoords, 15);
  const allStops = [
    ...appleSampled.map(([lat, lng]) => `${lat},${lng}`),
    `${finalDest.lat},${finalDest.lng}`,
  ];
  const daddr = allStops.join("+to:");
  const appleMapsUrl =
    `https://maps.apple.com/?saddr=${userLocation.lat},${userLocation.lng}` +
    `&daddr=${daddr}&dirflg=d`;

  return { googleMapsUrl, wazeUrl, appleMapsUrl };
}

/**
 * Build a complete route plan with all legs, distance/time estimates,
 * and navigation URLs.
 *
 * Legs:
 * 1. Commute: user location -> route start (always present)
 * 2. Route: the curated ride itself (polylineUrl for CDN loading)
 * 3. Destination: route end -> selected destination (if endpoint and >200m away)
 *
 * The route leg polyline is NOT fetched here — it returns a polylineUrl
 * for the client to load from CDN.
 */
export function buildRoutePlan(
  routeId: string,
  direction: "forward" | "reverse" | undefined,
  userLat: number,
  userLng: number,
  destinationName?: string
): RoutePlan | null {
  const route = getRouteById(routeId);
  if (!route) return null;

  const userLocation: LatLng = { lat: userLat, lng: userLng };

  // Direction logic:
  // - If explicitly provided (user clicked "Ride in reverse"), use it
  // - Otherwise default to "forward" but check if reverse would be better
  const suggestion = suggestDirection(userLocation, route);
  const directionResult = direction
    ? { direction, suggestReverse: false, reverseReason: undefined }
    : { direction: "forward" as const, suggestReverse: suggestion.suggestReverse, reverseReason: suggestion.reverseReason };

  const activeDirection = directionResult.direction;
  const { start: routeStart, end: routeEnd } = getRouteEndpoints(
    route,
    activeDirection
  );

  const legs: RouteLeg[] = [];

  // Leg 1: Commute — user -> route start
  const commute = estimateDriving(userLocation, routeStart);
  legs.push({
    type: "commute",
    label: `Your location \u2192 ${activeDirection === "forward" ? "Starting area" : "Route end (reverse start)"}`,
    distanceKm: commute.distanceKm,
    durationMinutes: commute.durationMinutes,
    style: "dashed-rider",
    // polyline filled by API after Valhalla call
  });

  // Leg 2: Route — the curated ride
  const polylineFile =
    activeDirection === "reverse"
      ? `${routeId}-reverse`
      : routeId;

  legs.push({
    type: "route",
    label: route.name,
    polylineUrl: `/routes/${polylineFile}.json`,
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    style: "solid-orange",
  });

  // Leg 3: Destination — route end -> selected destination (if needed)
  const destination = resolveDestination(route, destinationName);
  let destinationLatLng: LatLng | undefined;

  if (destination && destination.position === "endpoint") {
    destinationLatLng = { lat: destination.lat, lng: destination.lng };
    const distToRouteEnd =
      haversineDistance(destinationLatLng, routeEnd) * 1000; // convert to metres

    if (distToRouteEnd > DESTINATION_THRESHOLD_M) {
      const destDriving = estimateDriving(routeEnd, destinationLatLng);
      legs.push({
        type: "destination",
        label: `\u2192 ${destination.name}`,
        distanceKm: destDriving.distanceKm,
        durationMinutes: destDriving.durationMinutes,
        style: "dashed-orange",
        // polyline filled by API after Valhalla call
      });
    }
  }

  // Totals
  const totalDistanceKm = Math.round(
    legs.reduce((sum, leg) => sum + leg.distanceKm, 0) * 10
  ) / 10;
  const totalDurationMinutes = legs.reduce(
    (sum, leg) => sum + leg.durationMinutes,
    0
  );

  // Navigation URLs
  const navUrls = generateNavUrls(
    route,
    activeDirection,
    userLocation,
    destinationLatLng
  );

  return {
    routeId,
    direction: activeDirection,
    legs,
    totalDistanceKm,
    totalDurationMinutes,
    googleMapsUrl: navUrls.googleMapsUrl,
    wazeUrl: navUrls.wazeUrl,
    appleMapsUrl: navUrls.appleMapsUrl,
    suggestReverse: directionResult.suggestReverse,
    reverseReason: directionResult.reverseReason,
  };
}
