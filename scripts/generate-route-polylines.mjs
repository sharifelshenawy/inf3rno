/**
 * Generate dense route polylines for all routes using Valhalla motorcycle routing.
 *
 * For each route, generates both forward and reverse polyline files
 * by calling the FOSSGIS Valhalla API with motorcycle costing.
 *
 * Usage: node scripts/generate-route-polylines.mjs
 *
 * Output: public/routes/<route-id>.json and public/routes/<route-id>-reverse.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_PATH = join(__dirname, "..", "src", "data", "routes.json");
const OUTPUT_DIR = join(__dirname, "..", "public", "routes");

const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";
const DELAY_MS = 2000; // 2-second delay between API calls

// ---------------------------------------------------------------------------
// Polyline decoder (precision 6 for Valhalla)
// ---------------------------------------------------------------------------
function decodePolyline(encoded, precision = 6) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
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

// ---------------------------------------------------------------------------
// Call Valhalla motorcycle routing API
// ---------------------------------------------------------------------------
async function callValhalla(waypoints) {
  // Build locations array: first and last are "break", intermediates are "through"
  const locations = waypoints.map((wp, i) => {
    const isEndpoint = i === 0 || i === waypoints.length - 1;
    return {
      lat: wp.lat,
      lon: wp.lng,
      type: isEndpoint ? "break" : "through",
    };
  });

  const requestBody = {
    locations,
    costing: "motorcycle",
    directions_options: { units: "km" },
  };

  const response = await fetch(VALHALLA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Valhalla HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const trip = data.trip;
  if (!trip || !trip.legs || trip.legs.length === 0) {
    throw new Error("No legs in Valhalla response");
  }

  // Decode all legs and concatenate (skip first point of subsequent legs to avoid duplication)
  let allPoints = [];
  for (let i = 0; i < trip.legs.length; i++) {
    const shape = trip.legs[i].shape;
    if (!shape) continue;
    const decoded = decodePolyline(shape, 6);
    if (i === 0) {
      allPoints = allPoints.concat(decoded);
    } else {
      // Skip first point (duplicate of previous leg's last point)
      allPoints = allPoints.concat(decoded.slice(1));
    }
  }

  // Extract distance (km) and duration (seconds -> minutes) from trip summary
  const distanceKm = Math.round(trip.summary.length * 10) / 10;
  const durationMinutes = Math.round(trip.summary.time / 60);

  return { polyline: allPoints, distanceKm, durationMinutes };
}

// ---------------------------------------------------------------------------
// Save a route polyline file
// ---------------------------------------------------------------------------
function saveRouteFile(routeId, direction, polyline, distanceKm, durationMinutes) {
  const suffix = direction === "reverse" ? "-reverse" : "";
  const filePath = join(OUTPUT_DIR, `${routeId}${suffix}.json`);

  const startPoint = polyline[0];
  const endPoint = polyline[polyline.length - 1];

  const data = {
    id: routeId,
    direction,
    polyline,
    totalPoints: polyline.length,
    distanceKm,
    durationMinutes,
    startPoint: { lat: startPoint[0], lng: startPoint[1] },
    endPoint: { lat: endPoint[0], lng: endPoint[1] },
  };

  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// Sleep helper
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const routes = JSON.parse(readFileSync(ROUTES_PATH, "utf-8"));
  console.log(`Found ${routes.length} routes. Generating forward + reverse polylines...\n`);

  let successCount = 0;
  let failCount = 0;
  const failures = [];

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const callNumber = i * 2 + 1;

    // Use routeShape if available (more accurate), otherwise fall back to waypoints
    const sourcePoints = route.routeShape && route.routeShape.length > 0
      ? route.routeShape
      : route.waypoints;

    const pointSource = route.routeShape && route.routeShape.length > 0
      ? "routeShape"
      : "waypoints";

    console.log(`[${callNumber}/32] ${route.name} (${route.id}) — FORWARD`);
    console.log(`  Using ${pointSource}: ${sourcePoints.length} points`);

    // --- Forward ---
    try {
      const forward = await callValhalla(sourcePoints);
      const fwdPath = saveRouteFile(route.id, "forward", forward.polyline, forward.distanceKm, forward.durationMinutes);
      console.log(`  OK: ${forward.polyline.length} points, ${forward.distanceKm} km, ${forward.durationMinutes} min`);
      console.log(`  Saved: ${fwdPath}`);
      successCount++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      failures.push(`${route.id} (forward)`);
      failCount++;
    }

    // Rate limit
    await sleep(DELAY_MS);

    // --- Reverse ---
    const reversePoints = [...sourcePoints].reverse();
    console.log(`[${callNumber + 1}/32] ${route.name} (${route.id}) — REVERSE`);

    try {
      const reverse = await callValhalla(reversePoints);
      const revPath = saveRouteFile(route.id, "reverse", reverse.polyline, reverse.distanceKm, reverse.durationMinutes);
      console.log(`  OK: ${reverse.polyline.length} points, ${reverse.distanceKm} km, ${reverse.durationMinutes} min`);
      console.log(`  Saved: ${revPath}`);
      successCount++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      failures.push(`${route.id} (reverse)`);
      failCount++;
    }

    // Rate limit (skip delay after last route)
    if (i < routes.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Done! ${successCount} succeeded, ${failCount} failed out of 32 total.`);

  if (failures.length > 0) {
    console.log(`\nFailed routes:`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  // Verify output
  console.log(`\nVerifying output files...`);
  const { readdirSync, statSync } = await import("fs");
  const files = readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".json"));
  console.log(`  Files in ${OUTPUT_DIR}: ${files.length}`);

  let allGood = true;
  for (const file of files) {
    const filePath = join(OUTPUT_DIR, file);
    const stat = statSync(filePath);
    const content = JSON.parse(readFileSync(filePath, "utf-8"));
    const sizeKB = Math.round(stat.size / 1024);

    if (content.totalPoints < 500) {
      console.log(`  WARNING: ${file} has only ${content.totalPoints} points (expected >500)`);
      allGood = false;
    }
    if (sizeKB < 10 || sizeKB > 500) {
      console.log(`  WARNING: ${file} is ${sizeKB}KB (expected 30-100KB)`);
    }
  }

  if (allGood && files.length === 32) {
    console.log(`  All ${files.length} files look good!`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
