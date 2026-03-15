type EventName =
  | "page_view"
  | "route_selected"
  | "route_completed"
  | "vibe_selected"
  | "difficulty_selected"
  | "duration_selected"
  | "bike_selected"
  | "fuel_stop_shown"
  | "nav_link_clicked"
  | "ride_created"
  | "ride_joined"
  | "ride_voted"
  | "ride_locked"
  | "share_clicked"
  | "login_started"
  | "login_completed"
  | "onboarding_completed"
  | "profile_updated";

export function trackEvent(event: EventName, data?: Record<string, unknown>) {
  // Fire and forget — don't await, don't block UI
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, data, path: window.location.pathname }),
  }).catch(() => {
    // Silently fail — analytics should never break the app
  });
}
