"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HandleSearch from "@/components/HandleSearch";
import type { Vibe, Difficulty } from "@/lib/routeMatcher";

interface AddedMember {
  id: string;
  handle: string;
  displayName: string | null;
}

const VIBES: { id: Vibe; emoji: string; label: string }[] = [
  { id: "twisty", emoji: "\u{1F3D4}\uFE0F", label: "Twisty" },
  { id: "scenic", emoji: "\u{1F30A}", label: "Scenic" },
  { id: "cruisy", emoji: "\u{1F6E3}\uFE0F", label: "Cruisy" },
  { id: "mix", emoji: "\u{1F500}", label: "Mix" },
];

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
  { id: "any", label: "Any" },
];

export default function NewRidePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [members, setMembers] = useState<AddedMember[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  const handleAddMember = (user: {
    id: string;
    handle: string;
    displayName: string | null;
  }) => {
    if (members.some((m) => m.id === user.id)) return;
    setMembers((prev) => [...prev, user]);
  };

  const handleRemoveMember = (userId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setCreating(true);
    setError("");

    try {
      // Create the ride
      const rideRes = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          scheduledAt: scheduledAt || undefined,
          vibe: vibe || undefined,
          difficulty: difficulty || undefined,
        }),
      });

      if (!rideRes.ok) {
        const data = await rideRes.json();
        throw new Error(data.error ?? "Failed to create ride");
      }

      const ride = await rideRes.json();

      // Show invite link
      const appUrl = window.location.origin;
      setInviteLink(`${appUrl}/rides/join/${ride.inviteCode}`);

      // Add members
      for (const member of members) {
        try {
          await fetch(`/api/rides/${ride.id}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ handle: member.handle }),
          });
        } catch {
          // Continue adding other members if one fails
        }
      }

      router.push(`/rides/${ride.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 py-2">
      <div>
        <h2 className="text-2xl font-bold text-white">New Group Ride</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Set up your ride, invite your crew, then vote on the plan.
        </p>
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6 space-y-5">
        {/* Title */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-[#999999] mb-2"
          >
            Ride title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError("");
            }}
            placeholder="Saturday Morning Rip"
            maxLength={100}
            autoFocus
            className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
          />
        </div>

        {/* Date/time */}
        <div>
          <label
            htmlFor="scheduledAt"
            className="block text-sm font-medium text-[#999999] mb-2"
          >
            Date &amp; time{" "}
            <span className="text-[#555555]">(optional)</span>
          </label>
          <input
            id="scheduledAt"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white text-base focus:outline-none focus:border-[#FF6B2B] transition-colors [color-scheme:dark]"
          />
        </div>

        {/* Vibe picker */}
        <div>
          <p className="text-sm font-medium text-[#999999] mb-2">Vibe</p>
          <div className="grid grid-cols-4 gap-2">
            {VIBES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVibe(vibe === v.id ? null : v.id)}
                className={`p-3 rounded-lg border text-center transition-all ${
                  vibe === v.id
                    ? "border-[#FF6B2B] bg-[#FF6B2B]/10"
                    : "border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#3A3A3A]"
                }`}
              >
                <span className="text-lg block">{v.emoji}</span>
                <span className="text-xs text-white font-medium block mt-1">
                  {v.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty picker */}
        <div>
          <p className="text-sm font-medium text-[#999999] mb-2">Difficulty</p>
          <div className="flex gap-2 flex-wrap">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() =>
                  setDifficulty(difficulty === d.id ? null : d.id)
                }
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  difficulty === d.id
                    ? "bg-[#FF6B2B] text-white"
                    : "bg-[#0A0A0A] text-zinc-400 border border-[#2A2A2A] hover:border-[#3A3A3A]"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Members */}
        <div>
          <p className="text-sm font-medium text-[#999999] mb-2">
            Invite riders
          </p>
          <HandleSearch onSelect={handleAddMember} />
          {members.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {members.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0A0A0A] border border-[#2A2A2A] text-sm text-white"
                >
                  @{m.handle}
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id)}
                    className="text-zinc-500 hover:text-red-400 transition-colors ml-0.5"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {inviteLink && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#999999]">Invite link</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-zinc-400 text-sm truncate"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-sm text-[#FF6B2B] font-medium hover:border-[#FF6B2B] transition-colors shrink-0"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !title.trim()}
          className="w-full py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {creating ? "Creating..." : "Create Ride"}
        </button>
      </div>
    </div>
  );
}
