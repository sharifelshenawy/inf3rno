"use client";

interface RideStatsCardProps {
  routeName: string;
  distanceKm: number;
  durationMinutes: number;
  difficulty: string;
  vibe: string;
  meetingPointName: string;
  destinationName: string;
  bikeName?: string;
  rangeKm?: number;
  riderName?: string;
}

const DIFFICULTY_BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  beginner: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", border: "rgba(34,197,94,0.3)" },
  intermediate: { bg: "rgba(234,179,8,0.15)", text: "#eab308", border: "rgba(234,179,8,0.3)" },
  advanced: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", border: "rgba(239,68,68,0.3)" },
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}hr`;
  return `${h}hr ${m}m`;
}

export default function RideStatsCard({
  routeName,
  distanceKm,
  durationMinutes,
  difficulty,
  vibe,
  meetingPointName,
  destinationName,
  bikeName,
  rangeKm,
  riderName,
}: RideStatsCardProps) {
  const diffColors = DIFFICULTY_BADGE_COLORS[difficulty] || {
    bg: "rgba(161,161,170,0.15)",
    text: "#a1a1aa",
    border: "rgba(161,161,170,0.3)",
  };

  return (
    <div
      className="mx-auto rounded-2xl overflow-hidden"
      style={{
        width: 375,
        background: "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)",
        border: "1px solid #2A2A2A",
      }}
    >
      {/* Top accent bar */}
      <div
        className="h-1 w-full"
        style={{ background: "linear-gradient(90deg, #FF6B2B 0%, #FF8B5B 50%, #FF6B2B 100%)" }}
      />

      <div className="px-6 pt-5 pb-6 space-y-5">
        {/* Branding */}
        <div className="flex items-center justify-center">
          <span className="text-xl font-bold tracking-tight">
            <span style={{ color: "#FF6B2B" }}>inf</span>
            <span className="text-white">3</span>
            <span style={{ color: "#FF6B2B" }}>rno</span>
          </span>
        </div>

        {/* Route name hero */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-white leading-tight">
            {routeName}
          </h2>
          {riderName && (
            <p className="text-sm" style={{ color: "#FF6B2B" }}>
              {riderName}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="h-px w-full" style={{ backgroundColor: "#2A2A2A" }} />

        {/* Stats 2x2 grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Distance */}
          <div
            className="rounded-xl px-4 py-3 text-center"
            style={{ backgroundColor: "rgba(255,107,43,0.06)", border: "1px solid rgba(255,107,43,0.15)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
              Distance
            </p>
            <p className="text-xl font-bold text-white mt-1">
              {distanceKm}
              <span className="text-sm font-normal" style={{ color: "#a1a1aa" }}> km</span>
            </p>
          </div>

          {/* Duration */}
          <div
            className="rounded-xl px-4 py-3 text-center"
            style={{ backgroundColor: "rgba(255,107,43,0.06)", border: "1px solid rgba(255,107,43,0.15)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
              Duration
            </p>
            <p className="text-xl font-bold text-white mt-1">
              {formatDuration(durationMinutes)}
            </p>
          </div>

          {/* Difficulty */}
          <div
            className="rounded-xl px-4 py-3 text-center"
            style={{ backgroundColor: diffColors.bg, border: `1px solid ${diffColors.border}` }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
              Difficulty
            </p>
            <p
              className="text-base font-bold mt-1 capitalize"
              style={{ color: diffColors.text }}
            >
              {difficulty}
            </p>
          </div>

          {/* Vibe */}
          <div
            className="rounded-xl px-4 py-3 text-center"
            style={{ backgroundColor: "rgba(255,107,43,0.06)", border: "1px solid rgba(255,107,43,0.15)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
              Vibe
            </p>
            <p className="text-base font-bold mt-1 capitalize" style={{ color: "#FF6B2B" }}>
              {vibe}
            </p>
          </div>
        </div>

        {/* Meeting point + Destination */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
              style={{ backgroundColor: "rgba(255,107,43,0.15)", color: "#FF6B2B" }}
            >
              A
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
                Meet at
              </p>
              <p className="text-sm font-medium text-white">{meetingPointName}</p>
            </div>
          </div>

          {/* Connector line */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-6 flex justify-center">
              <div className="w-px h-4" style={{ backgroundColor: "#2A2A2A" }} />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
              style={{ backgroundColor: "rgba(255,107,43,0.15)", color: "#FF6B2B" }}
            >
              B
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
                Destination
              </p>
              <p className="text-sm font-medium text-white">{destinationName}</p>
            </div>
          </div>
        </div>

        {/* Bike info (optional) */}
        {(bikeName || rangeKm !== undefined) && (
          <>
            <div className="h-px w-full" style={{ backgroundColor: "#2A2A2A" }} />
            <div className="flex items-center justify-center gap-3 text-sm">
              {bikeName && (
                <span className="text-white font-medium">{bikeName}</span>
              )}
              {bikeName && rangeKm !== undefined && (
                <span style={{ color: "#3f3f46" }}>&bull;</span>
              )}
              {rangeKm !== undefined && (
                <span style={{ color: "#a1a1aa" }}>
                  {Math.round(rangeKm)} km range
                </span>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="h-px w-full" style={{ backgroundColor: "#2A2A2A" }} />
        <p className="text-center text-xs" style={{ color: "#52525b" }}>
          Planned with{" "}
          <span style={{ color: "#FF6B2B" }}>inf</span>
          <span className="text-white">3</span>
          <span style={{ color: "#FF6B2B" }}>rno</span>
          {" "}&mdash; inf3rno.vercel.app
        </p>
      </div>
    </div>
  );
}
