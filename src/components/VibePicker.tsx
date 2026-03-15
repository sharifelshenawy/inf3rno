"use client";

import { useState } from "react";
import type { Vibe, Difficulty, Duration } from "@/lib/routeMatcher";

interface VibePickerProps {
  onSubmit: (vibe: Vibe, difficulty: Difficulty, duration: Duration) => void;
  onBack: () => void;
}

const VIBES: { id: Vibe; emoji: string; label: string; desc: string }[] = [
  { id: "twisty", emoji: "\u{1F3D4}\uFE0F", label: "Twisty", desc: "Tight corners, switchbacks" },
  { id: "scenic", emoji: "\u{1F30A}", label: "Scenic", desc: "Views, coastal, relaxed" },
  { id: "cruisy", emoji: "\u{1F6E3}\uFE0F", label: "Cruisy", desc: "Easy, gentle, social" },
  { id: "mix", emoji: "\u{1F500}", label: "Mix", desc: "Best of everything" },
];

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
  { id: "any", label: "Any" },
];

const DURATIONS: { id: Duration; label: string; desc: string }[] = [
  { id: "short", label: "Short", desc: "Up to 1 hour" },
  { id: "medium", label: "Medium", desc: "2-3 hours" },
  { id: "long", label: "Long", desc: "4+ hours (iron butt)" },
  { id: "any", label: "Any", desc: "Show all" },
];

export default function VibePicker({ onSubmit, onBack }: VibePickerProps) {
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<Difficulty | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<Duration>("any");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">
          What&apos;s the vibe?
        </h2>
        <p className="text-sm text-zinc-400">
          Pick your ride style, skill level, and how long you want to ride.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {VIBES.map((vibe) => (
          <button
            key={vibe.id}
            onClick={() => setSelectedVibe(vibe.id)}
            className={`p-4 rounded-lg border text-left transition-all ${
              selectedVibe === vibe.id
                ? "border-[#FF6B2B] bg-[#FF6B2B]/10"
                : "border-[#2A2A2A] bg-[#141414] hover:border-[#3A3A3A]"
            }`}
          >
            <span className="text-2xl block mb-1">{vibe.emoji}</span>
            <span className="text-white font-semibold block">{vibe.label}</span>
            <span className="text-xs text-zinc-400">{vibe.desc}</span>
          </button>
        ))}
      </div>

      <div>
        <p className="text-sm text-zinc-400 mb-3">Difficulty</p>
        <div className="flex gap-2 flex-wrap">
          {DIFFICULTIES.map((diff) => (
            <button
              key={diff.id}
              onClick={() => setSelectedDifficulty(diff.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedDifficulty === diff.id
                  ? "bg-[#FF6B2B] text-white"
                  : "bg-[#141414] text-zinc-400 border border-[#2A2A2A] hover:border-[#3A3A3A]"
              }`}
            >
              {diff.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-zinc-400 mb-3">How long do you want to ride?</p>
        <div className="grid grid-cols-2 gap-2">
          {DURATIONS.map((dur) => (
            <button
              key={dur.id}
              onClick={() => setSelectedDuration(dur.id)}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedDuration === dur.id
                  ? "border-[#FF6B2B] bg-[#FF6B2B]/10"
                  : "border-[#2A2A2A] bg-[#141414] hover:border-[#3A3A3A]"
              }`}
            >
              <span className="text-white font-semibold text-sm block">{dur.label}</span>
              <span className="text-xs text-zinc-500">{dur.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="h-14 px-6 rounded-lg border border-[#2A2A2A] text-zinc-400 font-semibold hover:border-[#3A3A3A] transition-colors"
        >
          Back
        </button>
        <button
          onClick={() =>
            selectedVibe &&
            selectedDifficulty &&
            onSubmit(selectedVibe, selectedDifficulty, selectedDuration)
          }
          disabled={!selectedVibe || !selectedDifficulty}
          className="flex-1 h-14 rounded-lg bg-[#FF6B2B] text-white text-lg font-bold hover:bg-[#FF6B2B]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Find my route
        </button>
      </div>
    </div>
  );
}
