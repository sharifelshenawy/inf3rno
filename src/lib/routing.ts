interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Decode an encoded polyline string into [lat, lng] coordinate pairs.
 * Supports both precision 5 (Google/OSRM) and precision 6 (Valhalla).
 */
function decodePolyline(
  encoded: string,
  precision: number = 6
): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / factor, lng / factor]);
  }

  return points;
}

/**
 * Fetch road-following route geometry from the FOSSGIS Valhalla server.
 * Uses motorcycle costing model — no API key required.
 *
 * Docs: https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/
 * Server: https://valhalla1.openstreetmap.de
 */
export async function fetchRouteGeometry(
  points: LatLng[]
): Promise<[number, number][] | null> {
  if (points.length < 2) return null;

  try {
    const locations = points.map((p) => ({ lat: p.lat, lon: p.lng }));
    const params = {
      locations,
      costing: "motorcycle",
      directions_options: { units: "km" },
    };

    const url = `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(params))}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const shape = data.trip?.legs?.[0]?.shape;
    if (!shape) return null;

    // Valhalla uses polyline precision 6
    return decodePolyline(shape, 6);
  } catch {
    // Fall back to FOSSGIS OSRM as backup
    return fetchOsrmFallback(points);
  }
}

/**
 * Fallback: FOSSGIS OSRM server (car routing, polyline precision 5).
 */
async function fetchOsrmFallback(
  points: LatLng[]
): Promise<[number, number][] | null> {
  try {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=polyline`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.[0]?.geometry) return null;

    // OSRM uses polyline precision 5
    return decodePolyline(data.routes[0].geometry, 5);
  } catch {
    return null;
  }
}
