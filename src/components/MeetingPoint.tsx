import type { MeetingPoint as MeetingPointType, RiderDistance } from "@/lib/midpoint";
import { RIDER_COLORS } from "@/lib/constants";

interface MeetingPointProps {
  point: MeetingPointType;
  riderDistances?: RiderDistance[];
  isSoloRide?: boolean;
}

const AMENITY_LABELS: Record<string, string> = {
  parking: "Parking",
  coffee: "Coffee",
  food: "Food",
  fuel: "Fuel",
  fuel_nearby: "Fuel nearby",
  toilets: "Toilets",
};

export default function MeetingPointCard({
  point,
  riderDistances,
  isSoloRide,
}: MeetingPointProps) {
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;

  return (
    <div className="p-4 rounded-lg bg-[#141414] border border-[#2A2A2A]">
      <div>
        <p className="text-xs text-[#FF6B2B] font-semibold uppercase tracking-wider mb-1">
          {isSoloRide ? "Starting Area" : "Meeting Point"}
        </p>
        <h3 className="text-lg font-bold text-white">{point.name}</h3>
        <p className="text-sm text-zinc-400 mt-0.5">{point.address}</p>
      </div>

      {riderDistances && riderDistances.length > 0 && (
        <div className="mt-3 space-y-1">
          {riderDistances.map((rd, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: RIDER_COLORS[i % RIDER_COLORS.length] }}
              />
              <span className="text-zinc-400">{rd.displayName}</span>
              <span className="text-zinc-600">&mdash;</span>
              <span className="text-zinc-500">
                ~{Math.round(rd.distanceKm)} km
              </span>
            </div>
          ))}
        </div>
      )}

      {point.amenities.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {point.amenities.map((amenity) => (
            <span
              key={amenity}
              className="px-2 py-0.5 rounded-full text-xs bg-[#1A1A1A] text-zinc-400 border border-[#2A2A2A]"
            >
              {AMENITY_LABELS[amenity] || amenity}
            </span>
          ))}
        </div>
      )}

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#FF6B2B] font-medium hover:underline"
      >
        Navigate here &rarr;
      </a>
    </div>
  );
}
