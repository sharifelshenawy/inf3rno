/**
 * Generate dense routeShape arrays for each route in routes.json
 * by calling the FOSSGIS Valhalla motorcycle routing API.
 *
 * Usage: node scripts/generate-route-shapes.mjs
 *
 * For each route, this script:
 * 1. Sends the existing waypoints to Valhalla
 * 2. Decodes the polyline6-encoded shape from ALL legs
 * 3. Downsamples to ~20-30 points (keeps start, end, evenly spaced intermediates)
 * 4. Writes the routeShape back into routes.json
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_PATH = join(__dirname, "..", "src", "data", "routes.json");

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

    points.push({ lat: lat / factor, lng: lng / factor });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Downsample points — keep first, last, and evenly spaced intermediates
// ---------------------------------------------------------------------------
function downsample(points, targetCount) {
  if (points.length <= targetCount) return points;

  const result = [points[0]];
  const step = (points.length - 1) / (targetCount - 1);
  for (let i = 1; i < targetCount - 1; i++) {
    const idx = Math.round(i * step);
    result.push(points[idx]);
  }
  result.push(points[points.length - 1]);
  return result;
}

// ---------------------------------------------------------------------------
// Round coordinates to 4 decimal places (~11m precision)
// ---------------------------------------------------------------------------
function roundCoord(point) {
  return {
    lat: Math.round(point.lat * 10000) / 10000,
    lng: Math.round(point.lng * 10000) / 10000,
  };
}

// ---------------------------------------------------------------------------
// Call Valhalla and get full decoded shape across all legs
// ---------------------------------------------------------------------------
async function getValhallaShape(waypoints) {
  const locations = waypoints.map((wp) => ({ lat: wp.lat, lon: wp.lng }));
  const params = {
    locations,
    costing: "motorcycle",
    directions_options: { units: "km" },
  };

  const url = `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(params))}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Valhalla HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const legs = data.trip?.legs;
  if (!legs || legs.length === 0) {
    throw new Error("No legs in Valhalla response");
  }

  // Decode all legs and concatenate (skip first point of subsequent legs to avoid duplication)
  let allPoints = [];
  for (let i = 0; i < legs.length; i++) {
    const shape = legs[i].shape;
    if (!shape) continue;
    const decoded = decodePolyline(shape, 6);
    if (i === 0) {
      allPoints = allPoints.concat(decoded);
    } else {
      // Skip first point (duplicate of previous leg's last point)
      allPoints = allPoints.concat(decoded.slice(1));
    }
  }

  return allPoints;
}

// ---------------------------------------------------------------------------
// Improved waypoints for specific routes
//
// The existing waypoints in routes.json are sparse (3-5 points). For some routes
// the Valhalla router may pick a different road without enough hints. These
// override waypoints add key intersections so Valhalla follows the correct road.
// ---------------------------------------------------------------------------
const ROUTE_OVERRIDES = {
  "reefton-spur": [
    { lat: -37.7550, lng: 145.3510 },  // Warburton
    { lat: -37.7466, lng: 145.4297 },  // Warburton Hwy near Yarra Junction
    { lat: -37.7540, lng: 145.5020 },  // McMahons Creek — Woods Point Rd
    { lat: -37.7700, lng: 145.5600 },  // Reefton Hotel area
    { lat: -37.7855, lng: 145.5700 },  // Reefton Spur Rd south
    { lat: -37.7500, lng: 145.5800 },  // Reefton Spur Rd — deep in twisties
    { lat: -37.7100, lng: 145.5900 },  // Approaching Cumberland Junction
    { lat: -37.6900, lng: 145.7100 },  // Cumberland Junction
    { lat: -37.6300, lng: 145.7200 },  // Maroondah Hwy towards Marysville
    { lat: -37.5600, lng: 145.7350 },  // Narbethong
    { lat: -37.5093, lng: 145.7476 },  // Marysville
  ],
  "black-spur": [
    { lat: -37.6536, lng: 145.5269 },  // Healesville
    { lat: -37.6350, lng: 145.5500 },  // Start of Black Spur on Maroondah Hwy
    { lat: -37.6100, lng: 145.5800 },  // Black Spur mid-section
    { lat: -37.5900, lng: 145.6100 },  // Black Spur sweepers
    { lat: -37.5700, lng: 145.6400 },  // Approaching Fernshaw
    { lat: -37.5550, lng: 145.6600 },  // Black Spur Inn area
    { lat: -37.5400, lng: 145.6800 },  // Dom Dom Saddle area
    { lat: -37.5170, lng: 145.7250 },  // Narbethong
    { lat: -37.5093, lng: 145.7476 },  // Marysville
  ],
  "great-ocean-road-torquay": [
    { lat: -38.3322, lng: 144.3260 },  // Torquay
    { lat: -38.3690, lng: 144.2830 },  // Jan Juc
    { lat: -38.4100, lng: 144.2500 },  // Bells Beach area
    { lat: -38.4697, lng: 144.1820 },  // Bells Beach Lookout
    { lat: -38.4630, lng: 144.0980 },  // Aireys Inlet
    { lat: -38.4810, lng: 144.0630 },  // Fairhaven
    { lat: -38.5080, lng: 144.0460 },  // Eastern View
    { lat: -38.5270, lng: 144.0070 },  // Approaching Lorne from east
    { lat: -38.5410, lng: 143.9750 },  // Lorne
    { lat: -38.5620, lng: 143.9400 },  // South of Lorne
    { lat: -38.6333, lng: 143.8900 },  // Wye River
    { lat: -38.6650, lng: 143.8400 },  // Kennett River
    { lat: -38.6920, lng: 143.7800 },  // Skenes Creek area
    { lat: -38.7568, lng: 143.6715 },  // Apollo Bay
  ],
  "kinglake-loop": [
    { lat: -37.6390, lng: 145.1940 },  // Hurstbridge
    { lat: -37.6270, lng: 145.2200 },  // Panton Hill area
    { lat: -37.6120, lng: 145.2780 },  // St Andrews
    { lat: -37.5800, lng: 145.3100 },  // Kinglake West
    { lat: -37.5330, lng: 145.3400 },  // Kinglake
    { lat: -37.4800, lng: 145.3600 },  // Kinglake Central approach
    { lat: -37.4580, lng: 145.3700 },  // Kinglake Central
    { lat: -37.4500, lng: 145.3300 },  // Kinglake — heading west
    { lat: -37.4700, lng: 145.2700 },  // Humevale Rd area
    { lat: -37.4900, lng: 145.2200 },  // Whittlesea approach
    { lat: -37.5273, lng: 145.1687 },  // Whittlesea
  ],
  "dandenong-ranges": [
    { lat: -37.8427, lng: 145.2722 },  // Bayswater
    { lat: -37.8480, lng: 145.2900 },  // The Basin
    { lat: -37.8540, lng: 145.3200 },  // Mountain Hwy climb
    { lat: -37.8540, lng: 145.3470 },  // Mt Dandenong Tourist Rd
    { lat: -37.8380, lng: 145.3550 },  // Kalorama
    { lat: -37.8285, lng: 145.3672 },  // SkyHigh Mt Dandenong
    { lat: -37.8400, lng: 145.3600 },  // Between SkyHigh and Sassafras
    { lat: -37.8620, lng: 145.3580 },  // Sassafras
    { lat: -37.8700, lng: 145.3550 },  // Sassafras to Olinda
    { lat: -37.8790, lng: 145.3530 },  // Olinda
  ],
  "great-alpine-road": [
    { lat: -36.7300, lng: 146.9630 },  // Bright
    { lat: -36.7800, lng: 146.9700 },  // Porepunkah area
    { lat: -36.8600, lng: 147.0200 },  // Between Bright and Harrietville
    { lat: -36.9280, lng: 147.0710 },  // Harrietville
    { lat: -36.9600, lng: 147.0900 },  // Start of alpine climb
    { lat: -37.0000, lng: 147.1100 },  // Mid-climb
    { lat: -37.0300, lng: 147.1300 },  // Approaching summit
    { lat: -37.0470, lng: 147.1430 },  // Mt Hotham Summit
    { lat: -37.0350, lng: 147.1970 },  // Dinner Plain
    { lat: -37.0400, lng: 147.2500 },  // Descending towards Omeo
    { lat: -37.0500, lng: 147.3300 },  // Mid descent
    { lat: -37.0700, lng: 147.4500 },  // Lower descent
    { lat: -37.0990, lng: 147.5930 },  // Omeo
  ],
  "donna-buang": [
    { lat: -37.7540, lng: 145.6890 },  // Warburton
    { lat: -37.7500, lng: 145.6930 },  // Start of Donna Buang Rd
    { lat: -37.7450, lng: 145.7000 },  // Early climb
    { lat: -37.7400, lng: 145.7100 },  // Mid climb
    { lat: -37.7350, lng: 145.7150 },  // Cement Creek area
    { lat: -37.7250, lng: 145.6950 },  // Upper section
    { lat: -37.7170, lng: 145.6850 },  // Summit
  ],
  "yarra-valley-loop": [
    { lat: -37.7570, lng: 145.3540 },  // Lilydale
    { lat: -37.7200, lng: 145.3600 },  // Coldstream area
    { lat: -37.6690, lng: 145.3700 },  // Yarra Glen
    { lat: -37.6600, lng: 145.4500 },  // Healesville Rd
    { lat: -37.6536, lng: 145.5269 },  // Healesville
    { lat: -37.6300, lng: 145.5500 },  // Start of Black Spur
    { lat: -37.5900, lng: 145.6100 },  // Mid Black Spur
    { lat: -37.5700, lng: 145.6600 },  // Black Spur Inn
    { lat: -37.5400, lng: 145.6900 },  // Dom Dom Saddle
    { lat: -37.5093, lng: 145.7476 },  // Marysville
    { lat: -37.5600, lng: 145.7300 },  // Narbethong
    { lat: -37.6900, lng: 145.7100 },  // Cumberland Junction
    { lat: -37.7550, lng: 145.6890 },  // Warburton
  ],
  "mornington-loop": [
    { lat: -38.1437, lng: 145.1230 },  // Frankston
    { lat: -38.1700, lng: 145.0800 },  // Mt Eliza
    { lat: -38.2240, lng: 145.0380 },  // Mornington
    { lat: -38.2700, lng: 144.9700 },  // Mt Martha
    { lat: -38.3200, lng: 144.9500 },  // Dromana
    { lat: -38.3490, lng: 144.9440 },  // Red Hill
    { lat: -38.3900, lng: 144.9200 },  // Arthurs Seat area
    { lat: -38.4300, lng: 144.8900 },  // Cape Schanck approach
    { lat: -38.4873, lng: 144.8656 },  // Cape Schanck
  ],
  "lorne-deans-marsh": [
    { lat: -38.5410, lng: 143.9750 },  // Lorne
    { lat: -38.5200, lng: 143.9500 },  // Lorne outskirts heading inland
    { lat: -38.5000, lng: 143.9200 },  // Climbing into Otways
    { lat: -38.4700, lng: 143.9000 },  // Mid Otways
    { lat: -38.4500, lng: 143.8800 },  // Upper section
    { lat: -38.4200, lng: 143.8750 },  // Approaching Deans Marsh
    { lat: -38.3800, lng: 143.8700 },  // Deans Marsh
  ],
  "skenes-creek-otways": [
    { lat: -38.6900, lng: 143.6950 },  // Skenes Creek
    { lat: -38.6700, lng: 143.7000 },  // Climbing from coast
    { lat: -38.6400, lng: 143.7050 },  // Lower Otways
    { lat: -38.6000, lng: 143.7100 },  // Mid climb
    { lat: -38.5600, lng: 143.7120 },  // Upper Otways
    { lat: -38.5170, lng: 143.7150 },  // Forrest
  ],
  "mt-baw-baw": [
    { lat: -38.0300, lng: 145.5600 },  // Warragul
    { lat: -38.0100, lng: 145.6200 },  // Neerim area
    { lat: -37.9800, lng: 145.7500 },  // Noojee
    { lat: -37.9500, lng: 145.8500 },  // Post-Noojee
    { lat: -37.9200, lng: 145.9500 },  // Climbing towards Baw Baw
    { lat: -37.8900, lng: 146.0500 },  // Mt Baw Baw Tourist Rd
    { lat: -37.8700, lng: 146.1500 },  // Upper climb
    { lat: -37.8600, lng: 146.2200 },  // Near summit
    { lat: -37.8390, lng: 146.2710 },  // Mt Baw Baw Village
  ],
  "lerderderg-gorge": [
    { lat: -37.6750, lng: 144.4330 },  // Bacchus Marsh
    { lat: -37.6400, lng: 144.4000 },  // Heading north
    { lat: -37.5900, lng: 144.3300 },  // Lerderderg Gorge Rd
    { lat: -37.5500, lng: 144.3200 },  // Gorge area
    { lat: -37.5100, lng: 144.3000 },  // Daylesford Rd
    { lat: -37.4500, lng: 144.2500 },  // Mid way to Daylesford
    { lat: -37.4000, lng: 144.2000 },  // Approaching Daylesford
    { lat: -37.3486, lng: 144.1500 },  // Daylesford
  ],
  "blackwood-trentham-loop": [
    { lat: -37.6750, lng: 144.4330 },  // Bacchus Marsh
    { lat: -37.6300, lng: 144.3800 },  // Heading towards Blackwood
    { lat: -37.5500, lng: 144.3400 },  // Mid way
    { lat: -37.4720, lng: 144.3050 },  // Blackwood
    { lat: -37.4300, lng: 144.3100 },  // Between Blackwood & Trentham
    { lat: -37.3880, lng: 144.3170 },  // Trentham
    { lat: -37.3700, lng: 144.2500 },  // Heading to Daylesford
    { lat: -37.3486, lng: 144.1500 },  // Daylesford
  ],
  "south-gippsland-cruise": [
    { lat: -38.2100, lng: 145.5600 },  // Korumburra
    { lat: -38.2700, lng: 145.6000 },  // South of Korumburra
    { lat: -38.3200, lng: 145.6400 },  // Approaching Meeniyan
    { lat: -38.3800, lng: 145.6700 },  // Meeniyan area
    { lat: -38.4400, lng: 145.6900 },  // Fish Creek
    { lat: -38.5200, lng: 145.7500 },  // Foster area
    { lat: -38.6000, lng: 145.8500 },  // Heading south
    { lat: -38.6800, lng: 146.0400 },  // Wilsons Prom Rd
    { lat: -38.8100, lng: 146.1500 },  // Yanakie
  ],
  "yarra-glen-loop": [
    { lat: -37.6690, lng: 145.3700 },  // Yarra Glen
    { lat: -37.6900, lng: 145.4000 },  // Heading towards Healesville Rd
    { lat: -37.7100, lng: 145.4300 },  // Yarra Valley
    { lat: -37.7320, lng: 145.4670 },  // Healesville Rd
    { lat: -37.7000, lng: 145.5000 },  // Approaching Healesville
    { lat: -37.6536, lng: 145.5269 },  // Healesville
    { lat: -37.6200, lng: 145.5100 },  // North of Healesville
    { lat: -37.5800, lng: 145.5000 },  // Dixons Creek
  ],
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const routes = JSON.parse(readFileSync(ROUTES_PATH, "utf-8"));
  const TARGET_POINTS = 25; // target number of routeShape points per route
  const DELAY_MS = 1500;    // delay between API calls to be polite

  console.log(`Processing ${routes.length} routes...\n`);

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const overrideWaypoints = ROUTE_OVERRIDES[route.id];
    const waypoints = overrideWaypoints || route.waypoints;

    console.log(`[${i + 1}/${routes.length}] ${route.name} (${route.id})`);
    console.log(`  Using ${overrideWaypoints ? "override" : "existing"} waypoints: ${waypoints.length} points`);

    try {
      const fullShape = await getValhallaShape(waypoints);
      console.log(`  Valhalla returned ${fullShape.length} points`);

      // Downsample to target
      const sampled = downsample(fullShape, TARGET_POINTS);
      const rounded = sampled.map(roundCoord);
      console.log(`  Downsampled to ${rounded.length} points`);

      route.routeShape = rounded;
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      console.log(`  Skipping — no routeShape added`);
    }

    // Rate limit
    if (i < routes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  writeFileSync(ROUTES_PATH, JSON.stringify(routes, null, 2) + "\n", "utf-8");
  console.log(`\nDone! Updated ${ROUTES_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
