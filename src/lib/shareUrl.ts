interface RiderLocation {
  lat: number;
  lng: number;
  displayName: string;
}

export type Vibe = "twisty" | "scenic" | "cruisy" | "mix";
export type Difficulty = "beginner" | "intermediate" | "advanced" | "any";

export interface RidePlan {
  riders: RiderLocation[];
  vibe: Vibe;
  difficulty: Difficulty;
  routeId?: string;
  destinationIdx?: number;
}

export function encodeRidePlan(plan: RidePlan): string {
  const riders = plan.riders
    .map(
      (r) =>
        `${r.lat},${r.lng},${encodeURIComponent(r.displayName)}`
    )
    .join("|");
  const params = new URLSearchParams({
    riders,
    vibe: plan.vibe,
    diff: plan.difficulty,
  });
  if (plan.routeId) {
    params.set("route", plan.routeId);
  }
  if (plan.destinationIdx !== undefined && plan.destinationIdx > 0) {
    params.set("dest", String(plan.destinationIdx));
  }
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export function decodeRidePlan(
  searchParams: URLSearchParams
): RidePlan | null {
  const ridersStr = searchParams.get("riders");
  const vibe = searchParams.get("vibe") as Vibe | null;
  const difficulty = searchParams.get("diff") as Difficulty | null;

  if (!ridersStr || !vibe || !difficulty) return null;

  try {
    const riders = ridersStr.split("|").map((r) => {
      const [lat, lng, ...nameParts] = r.split(",");
      return {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        displayName: decodeURIComponent(nameParts.join(",")),
      };
    });

    if (
      riders.length < 2 ||
      riders.some((r) => isNaN(r.lat) || isNaN(r.lng))
    ) {
      return null;
    }

    const routeId = searchParams.get("route") || undefined;
    const destStr = searchParams.get("dest");
    const destinationIdx = destStr ? parseInt(destStr, 10) : undefined;

    return { riders, vibe, difficulty, routeId, destinationIdx };
  } catch {
    return null;
  }
}
