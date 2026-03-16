"use client";

import { useState } from "react";
import type { PointOfInterest } from "@/lib/poi";

interface PointsOfInterestProps {
  pois: PointOfInterest[];
  routeDistanceKm: number;
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  fuel: { label: "Fuel", icon: "\u26FD", color: "text-yellow-400" },
  medical: { label: "Medical", icon: "\u{1F3E5}", color: "text-red-400" },
  rest: { label: "Rest Stop", icon: "\u2615", color: "text-blue-400" },
};

export default function PointsOfInterest({
  pois,
  routeDistanceKm,
}: PointsOfInterestProps) {
  const [showType, setShowType] = useState<"all" | "fuel" | "medical">("all");

  const fuelPois = pois.filter((p) => p.type === "fuel");
  const medicalPois = pois.filter((p) => p.type === "medical");

  const filtered =
    showType === "all" ? pois : pois.filter((p) => p.type === showType);

  const needsFuelWarning = routeDistanceKm > 120 && fuelPois.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
          Points of Interest
        </p>
        <div className="flex gap-1">
          {(["all", "fuel", "medical"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setShowType(type)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                showType === type
                  ? "bg-[#FF6B2B] text-white"
                  : "bg-[#141414] text-zinc-500 border border-[#2A2A2A]"
              }`}
            >
              {type === "all" ? "All" : type === "fuel" ? "\u26FD Fuel" : "\u{1F3E5} Medical"}
            </button>
          ))}
        </div>
      </div>

      {needsFuelWarning && (
        <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-2">
          <span className="text-sm">{"\u26FD"}</span>
          <div>
            <p className="text-xs text-yellow-400 font-medium">
              Fuel range warning
            </p>
            <p className="text-xs text-yellow-400/70 mt-0.5">
              This route is {routeDistanceKm} km. Fill up before you go and
              note the fuel stops below.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {filtered.map((poi, i) => {
          const config = TYPE_CONFIG[poi.type] || TYPE_CONFIG.rest;
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}&travelmode=driving`;

          return (
            <a
              key={i}
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-lg bg-[#141414] border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors"
            >
              <span className="text-base mt-0.5">{config.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium truncate">
                    {poi.name}
                  </span>
                  <span
                    className={`text-xs ${config.color} shrink-0`}
                  >
                    {config.label}
                  </span>
                </div>
                {poi.notes && (
                  <p className="text-xs text-zinc-500 mt-0.5">{poi.notes}</p>
                )}
              </div>
              <span className="text-xs text-zinc-600 shrink-0">&rarr;</span>
            </a>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-4">
          No {showType} stops on this route.
        </p>
      )}

      {medicalPois.length > 0 && showType === "all" && (
        <p className="text-xs text-zinc-600 text-center">
          In an emergency, always call 000
        </p>
      )}
    </div>
  );
}
