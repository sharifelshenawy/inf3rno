"use client";

import { useState } from "react";
import type { Route } from "@/lib/routeMatcher";
import RouteGallery from "./RouteGallery";

interface RouteSelectorProps {
  routes: Route[];
  onSelect: (route: Route) => void;
  onBack: () => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function RouteSelector({
  routes,
  onSelect,
  onBack,
}: RouteSelectorProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (routes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="py-12 text-center">
          <p className="text-2xl text-white mb-2">No routes match</p>
          <p className="text-zinc-400">
            Try a different vibe or difficulty combo.
          </p>
        </div>
        <button
          onClick={onBack}
          className="w-full h-14 rounded-lg border border-[#2A2A2A] text-white font-bold hover:border-[#3A3A3A] transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Pick a ride</h2>
        <p className="text-sm text-zinc-400">
          {routes.length} route{routes.length !== 1 ? "s" : ""} matched. Tap
          to preview, then select.
        </p>
      </div>

      <div className="space-y-3">
        {routes.map((route) => {
          const isPreviewing = previewId === route.id;

          return (
            <div key={route.id} className="space-y-2">
              <button
                onClick={() =>
                  setPreviewId(isPreviewing ? null : route.id)
                }
                className={`w-full text-left p-4 rounded-lg border transition-all space-y-2 ${
                  isPreviewing
                    ? "border-[#FF6B2B] bg-[#FF6B2B]/5"
                    : "bg-[#141414] border-[#2A2A2A] hover:border-[#3A3A3A]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-white font-bold">{route.name}</h3>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${
                      DIFFICULTY_COLORS[route.difficulty] ||
                      "bg-zinc-500/20 text-zinc-400"
                    }`}
                  >
                    {route.difficulty}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 line-clamp-2">
                  {route.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{route.distanceKm} km</span>
                  <span>&middot;</span>
                  <span>
                    ~{Math.round(route.durationMinutes / 60)}h{" "}
                    {route.durationMinutes % 60}m
                  </span>
                  <span>&middot;</span>
                  <span>{route.vibe.join(", ")}</span>
                </div>
                {route.highlights.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {route.highlights.slice(0, 3).map((h) => (
                      <span
                        key={h}
                        className="px-2 py-0.5 rounded-full text-xs bg-[#FF6B2B]/10 text-[#FF6B2B]/80"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </button>

              {/* Preview panel */}
              {isPreviewing && (
                <div className="space-y-3 px-1">
                  <RouteGallery routeId={route.id} />

                  {route.warnings.length > 0 && (
                    <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                      <p className="text-xs text-yellow-400/80">
                        {route.warnings.join(" \u2022 ")}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => onSelect(route)}
                    className="w-full h-12 rounded-lg bg-[#FF6B2B] text-white font-bold hover:bg-[#FF6B2B]/90 transition-colors"
                  >
                    Ride this route
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onBack}
        className="w-full h-12 rounded-lg border border-[#2A2A2A] text-zinc-400 font-semibold hover:border-[#3A3A3A] transition-colors"
      >
        Back
      </button>
    </div>
  );
}
