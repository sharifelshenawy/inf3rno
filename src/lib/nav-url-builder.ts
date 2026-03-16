/**
 * Client-side navigation URL builder.
 *
 * Generates Google Maps, Waze, and Apple Maps deep links with sampled
 * waypoints from a full CDN polyline. This produces much more accurate
 * turn-by-turn navigation than the server-side estimates in route-engine.ts,
 * because it uses the dense polyline (1,000-5,000 points) to force the
 * nav app onto the correct roads.
 *
 * Usage: Load the CDN polyline on the client, then call these functions
 * to build the final nav URLs before the user taps "Navigate".
 */

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Sample evenly-spaced points from a polyline.
 * Always includes the first and last point.
 */
function samplePolyline(
  polyline: [number, number][],
  maxPoints: number
): [number, number][] {
  if (polyline.length <= maxPoints) {
    return [...polyline];
  }

  const sampled: [number, number][] = [];
  const step = Math.max(1, Math.floor((polyline.length - 1) / (maxPoints - 1)));

  for (let i = 0; i < polyline.length && sampled.length < maxPoints - 1; i += step) {
    sampled.push(polyline[i]);
  }

  // Always include the last point
  const last = polyline[polyline.length - 1];
  if (
    sampled.length === 0 ||
    sampled[sampled.length - 1][0] !== last[0] ||
    sampled[sampled.length - 1][1] !== last[1]
  ) {
    sampled.push(last);
  }

  return sampled;
}

/**
 * Build a Google Maps directions URL with sampled waypoints from the
 * full route polyline.
 *
 * Google Maps supports max 25 stops total: origin + destination + 23 waypoints.
 * The sampled waypoints force Google Maps onto the correct motorcycle roads.
 *
 * @param origin       User's starting location
 * @param routePolyline Dense polyline from the CDN route file
 * @param destination  Final destination (cafe, bakery, etc.)
 * @param maxWaypoints Maximum waypoints to sample (default 23, the Google Maps limit)
 */
export function buildGoogleMapsUrl(
  origin: LatLng,
  routePolyline: [number, number][],
  destination: LatLng,
  maxWaypoints: number = 23
): string {
  const sampled = samplePolyline(routePolyline, maxWaypoints);
  const waypointsStr = sampled
    .map(([lat, lng]) => `${lat},${lng}`)
    .join("|");

  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${origin.lat},${origin.lng}` +
    `&destination=${destination.lat},${destination.lng}` +
    `&waypoints=${waypointsStr}` +
    `&travelmode=driving`
  );
}

/**
 * Build a Waze navigation URL.
 *
 * Waze only supports single-destination navigation via URL. We navigate
 * to the first meaningful stop (the route start). Once the rider arrives,
 * they can tap the next leg manually.
 *
 * @param origin    User's starting location
 * @param firstStop First stop on the route (typically the route start)
 */
export function buildWazeUrl(origin: LatLng, firstStop: LatLng): string {
  return (
    `https://waze.com/ul?ll=${firstStop.lat},${firstStop.lng}` +
    `&navigate=yes&from=${origin.lat},${origin.lng}`
  );
}

/**
 * Build an Apple Maps directions URL with sampled waypoints.
 *
 * Apple Maps supports multi-stop routing via the "daddr" parameter with
 * "+to:" separators between stops. Fewer waypoints than Google Maps are
 * recommended for URL length and app performance.
 *
 * @param origin        User's starting location
 * @param routePolyline Dense polyline from the CDN route file
 * @param destination   Final destination
 * @param maxWaypoints  Maximum waypoints to sample (default 15)
 */
export function buildAppleMapsUrl(
  origin: LatLng,
  routePolyline: [number, number][],
  destination: LatLng,
  maxWaypoints: number = 15
): string {
  const sampled = samplePolyline(routePolyline, maxWaypoints);
  const allStops = [
    ...sampled.map(([lat, lng]) => `${lat},${lng}`),
    `${destination.lat},${destination.lng}`,
  ];
  const daddr = allStops.join("+to:");

  return (
    `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}` +
    `&daddr=${daddr}&dirflg=d`
  );
}
