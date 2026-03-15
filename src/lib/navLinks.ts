interface LatLng {
  lat: number;
  lng: number;
}

export function generateGoogleMapsUrl(
  origin: LatLng,
  waypoints: LatLng[],
  destination: LatLng
): string {
  const waypointsStr = waypoints
    .map((wp) => `${wp.lat},${wp.lng}`)
    .join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&waypoints=${waypointsStr}&travelmode=driving`;
}

/**
 * Waze doesn't support multi-stop natively via URL.
 * Best approach: navigate to the first waypoint. Once arrived, user taps next leg.
 * We provide a "full route" option that opens Google Maps as fallback.
 */
export function generateWazeUrl(
  origin: LatLng,
  waypoints: LatLng[],
  destination: LatLng
): string {
  // Waze can only navigate to one point at a time.
  // Navigate to the first stop (first waypoint, or destination if no waypoints).
  const firstStop = waypoints.length > 0 ? waypoints[0] : destination;
  return `https://waze.com/ul?ll=${firstStop.lat},${firstStop.lng}&navigate=yes&from=${origin.lat},${origin.lng}`;
}

/**
 * Apple Maps supports multi-stop via chained waypoints using the 'daddr' param
 * with '+to:' syntax for intermediate stops.
 */
export function generateAppleMapsUrl(
  origin: LatLng,
  waypoints: LatLng[],
  destination: LatLng
): string {
  // Apple Maps: saddr=origin, daddr=wp1+to:wp2+to:destination
  const allStops = [...waypoints, destination];
  const daddr = allStops
    .map((p) => `${p.lat},${p.lng}`)
    .join("+to:");
  return `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${daddr}&dirflg=d`;
}
