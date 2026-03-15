import routesData from "@/data/routes.json";

export interface RouteWaypoint {
  lat: number;
  lng: number;
  label: string;
}

export interface RouteDestination {
  name: string;
  lat: number;
  lng: number;
  type: string;
  position: "endpoint" | "enroute";
}

export interface Route {
  id: string;
  name: string;
  description: string;
  vibe: string[];
  difficulty: string;
  durationMinutes: number;
  distanceKm: number;
  region: string;
  meetingPointIds: string[];
  waypoints: RouteWaypoint[];
  destinations: RouteDestination[];
  highlights: string[];
  warnings: string[];
}

export type Vibe = "twisty" | "scenic" | "cruisy" | "mix";
export type Difficulty = "beginner" | "intermediate" | "advanced" | "any";
export type Duration = "short" | "medium" | "long" | "any";

const DURATION_RANGES: Record<Duration, { min: number; max: number }> = {
  short: { min: 0, max: 60 },        // up to 1 hour
  medium: { min: 60, max: 180 },      // 1-3 hours
  long: { min: 180, max: Infinity },   // 4+ hours (iron butt)
  any: { min: 0, max: Infinity },
};

/**
 * Filter and score routes by vibe, difficulty, and duration.
 * Meeting point is computed AFTER route selection.
 */
export function filterRoutes(
  vibe: Vibe,
  difficulty: Difficulty,
  duration: Duration = "any"
): Route[] {
  const routes = routesData as Route[];
  const dRange = DURATION_RANGES[duration];

  const scored = routes.map((route) => {
    let score = 0;

    // Duration filter — hard exclude if outside range
    if (route.durationMinutes < dRange.min || route.durationMinutes > dRange.max) {
      return { route, score: 0 };
    }

    // Vibe matching
    if (vibe === "mix") {
      score += 2;
    } else if (vibe === "cruisy") {
      if (route.vibe.includes("scenic") && route.difficulty === "beginner") {
        score += 5;
      } else if (route.vibe.includes("scenic")) {
        score += 2;
      }
    } else if (route.vibe.includes(vibe)) {
      score += 5;
    }

    // Difficulty matching
    if (difficulty === "any") {
      score += 2;
    } else if (route.difficulty === difficulty) {
      score += 3;
    }

    // Duration bonus — prefer routes closer to the middle of the selected range
    if (duration !== "any") {
      score += 1;
    }

    return { route, score };
  });

  return scored
    .filter((s) => s.score > 2)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.route);
}
