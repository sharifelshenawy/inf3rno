"use client";

import { useState } from "react";
import { geocodeSuburb } from "@/lib/geocode";
import { RIDER_COLORS } from "@/lib/constants";

export interface RiderLocation {
  lat: number;
  lng: number;
  displayName: string;
}

interface RiderInputProps {
  onNext: (riders: RiderLocation[]) => void;
  initialRiders?: RiderLocation[];
  minRiders?: number;
}

export default function RiderInput({
  onNext,
  initialRiders = [],
  minRiders = 2,
}: RiderInputProps) {
  const [riders, setRiders] = useState<RiderLocation[]>(initialRiders);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRider = async () => {
    if (!input.trim() || riders.length >= 5) return;

    setLoading(true);
    setError(null);

    const result = await geocodeSuburb(input.trim());
    if (result) {
      setRiders([...riders, result]);
      setInput("");
    } else {
      setError("Couldn't find that suburb. Try adding VIC or a postcode.");
    }

    setLoading(false);
  };

  const removeRider = (index: number) => {
    setRiders(riders.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addRider();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">
          Where is everyone?
        </h2>
        <p className="text-sm text-zinc-400">
          Add rider starting locations to find a central meeting point.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Clyde, Broadmeadows, Werribee"
            disabled={loading || riders.length >= 5}
            className="flex-1 h-12 px-4 rounded-lg bg-[#141414] border border-[#2A2A2A] text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FF6B2B] transition-colors disabled:opacity-50"
          />
          <button
            onClick={addRider}
            disabled={loading || !input.trim() || riders.length >= 5}
            className="h-12 px-5 rounded-lg bg-[#FF6B2B] text-white font-semibold hover:bg-[#FF6B2B]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              "Add"
            )}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <p className="text-xs text-zinc-500">
          {riders.length}/5 riders added
          {riders.length < minRiders && ` — need at least ${minRiders}`}
        </p>
      </div>

      {riders.length > 0 && (
        <div className="space-y-2">
          {riders.map((rider, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-[#141414] border border-[#2A2A2A]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: RIDER_COLORS[i % RIDER_COLORS.length] }}
                />
                <span className="text-white font-medium">
                  {rider.displayName}
                </span>
              </div>
              <button
                onClick={() => removeRider(i)}
                className="text-zinc-500 hover:text-red-400 transition-colors p-1"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {riders.length >= minRiders && (
        <button
          onClick={() => onNext(riders)}
          className="w-full h-14 rounded-lg bg-[#FF6B2B] text-white text-lg font-bold hover:bg-[#FF6B2B]/90 transition-colors"
        >
          Choose your vibe
        </button>
      )}
    </div>
  );
}
