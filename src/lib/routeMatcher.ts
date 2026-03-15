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

/**
 * Filter and score routes by vibe + difficulty only.
 * Meeting point is computed AFTER route selection.
 */
export function filterRoutes(vibe: Vibe, difficulty: Difficulty): Route[] {
  const routes = routesData as Route[];

  const scored = routes.map((route) => {
    let score = 0;

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

    return { route, score };
  });

  return scored
    .filter((s) => s.score > 2)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.route);
}
