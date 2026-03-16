import { NextRequest, NextResponse } from "next/server";
import {
  buildRoutePlan,
  getRouteById,
} from "@/lib/route-engine";
import { fetchRouteGeometry } from "@/lib/routing";

interface RoutePlanRequest {
  routeId?: string;
  direction?: "forward" | "reverse";
  userLat?: number;
  userLng?: number;
  destinationName?: string;
}

/**
 * Simple in-memory cache for route plans.
 * Key: "routeId:direction:roundedLat:roundedLng:destination"
 * TTL: 5 minutes.
 */
interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function getCacheKey(
  routeId: string,
  direction: string,
  lat: number,
  lng: number,
  dest: string
): string {
  // Round coordinates to ~100m precision for cache hits
  const rLat = Math.round(lat * 1000) / 1000;
  const rLng = Math.round(lng * 1000) / 1000;
  return `${routeId}:${direction}:${rLat}:${rLng}:${dest}`;
}

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown): void {
  // Evict expired entries periodically (every 50 writes)
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiresAt) cache.delete(k);
    }
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * POST /api/route-plan
 *
 * Builds a full route plan with commute and destination legs.
 * Calls Valhalla server-side for dynamic polylines (commute + destination legs).
 * Returns structured leg data with nav URLs.
 *
 * Request body:
 *   routeId: string          — route ID from routes.json
 *   direction?: "forward"|"reverse" — auto-detected if omitted
 *   userLat: number          — user's latitude
 *   userLng: number          — user's longitude
 *   destinationName?: string — selected destination name
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RoutePlanRequest;
    const { routeId, direction, userLat, userLng, destinationName } = body;

    // Validate required fields
    if (!routeId || typeof routeId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid routeId" },
        { status: 400 }
      );
    }
    if (typeof userLat !== "number" || typeof userLng !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid userLat/userLng" },
        { status: 400 }
      );
    }
    if (
      userLat < -90 ||
      userLat > 90 ||
      userLng < -180 ||
      userLng > 180
    ) {
      return NextResponse.json(
        { error: "Coordinates out of valid range" },
        { status: 400 }
      );
    }
    if (
      direction !== undefined &&
      direction !== "forward" &&
      direction !== "reverse"
    ) {
      return NextResponse.json(
        { error: "direction must be 'forward' or 'reverse'" },
        { status: 400 }
      );
    }

    // Validate route exists
    const route = getRouteById(routeId);
    if (!route) {
      return NextResponse.json(
        { error: `Route '${routeId}' not found` },
        { status: 404 }
      );
    }

    // Check cache
    const cacheKey = getCacheKey(
      routeId,
      direction ?? "auto",
      userLat,
      userLng,
      destinationName ?? ""
    );
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Build the route plan (direction auto-detected if not provided)
    const plan = buildRoutePlan(
      routeId,
      direction,
      userLat,
      userLng,
      destinationName
    );
    if (!plan) {
      return NextResponse.json(
        { error: "Failed to build route plan" },
        { status: 500 }
      );
    }

    // Fetch Valhalla polylines server-side for dynamic legs
    const valhallaPromises = plan.legs.map(async (leg) => {
      // Only fetch polylines for commute and destination legs
      // The route leg uses a CDN polylineUrl instead
      if (leg.type === "route") return;

      let fromPoint: { lat: number; lng: number } | undefined;
      let toPoint: { lat: number; lng: number } | undefined;

      if (leg.type === "commute") {
        // User location -> route start
        const waypoints = route.waypoints;
        const routeStart =
          plan.direction === "forward"
            ? waypoints[0]
            : waypoints[waypoints.length - 1];
        fromPoint = { lat: userLat, lng: userLng };
        toPoint = { lat: routeStart.lat, lng: routeStart.lng };
      } else if (leg.type === "destination") {
        // Route end -> destination
        const waypoints = route.waypoints;
        const routeEnd =
          plan.direction === "forward"
            ? waypoints[waypoints.length - 1]
            : waypoints[0];
        const dest = route.destinations.find(
          (d) =>
            destinationName &&
            d.name.toLowerCase() === destinationName.toLowerCase()
        ) ?? route.destinations.find((d) => d.position === "endpoint");

        if (dest) {
          fromPoint = { lat: routeEnd.lat, lng: routeEnd.lng };
          toPoint = { lat: dest.lat, lng: dest.lng };
        }
      }

      if (fromPoint && toPoint) {
        try {
          const polyline = await fetchRouteGeometry([fromPoint, toPoint]);
          if (polyline) {
            leg.polyline = polyline;

            // Update distance/duration from actual route if we got points
            // (Valhalla response gives us real road distance via polyline length)
            // For now, keep the haversine estimates — Valhalla summary parsing
            // can be added when we refactor fetchRouteGeometry to return metadata
          }
        } catch {
          // Valhalla failed — leg keeps the haversine estimate, no polyline
          // The client can still render a straight dashed line
        }
      }
    });

    await Promise.all(valhallaPromises);

    // Cache the result
    setCache(cacheKey, plan);

    return NextResponse.json(plan);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
