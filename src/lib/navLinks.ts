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

export function generateWazeUrl(destination: LatLng): string {
  return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
}

export function generateAppleMapsUrl(destination: LatLng): string {
  return `https://maps.apple.com/?daddr=${destination.lat},${destination.lng}&dirflg=d`;
}
