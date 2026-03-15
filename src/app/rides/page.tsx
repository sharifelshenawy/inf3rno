"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import RideCard from "@/components/RideCard";

interface RideListItem {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  memberCount: number;
  vibe: string | null;
  difficulty: string | null;
  createdAt: string;
}

const ACTIVE_STATUSES = ["DRAFT", "VOTING", "LOCKED"];

export default function RidesListPage() {
  const [rides, setRides] = useState<RideListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchRides() {
      try {
        const res = await fetch("/api/rides");
        if (!res.ok) {
          if (res.status === 401) {
            setError("Please log in to view your rides.");
            return;
          }
          throw new Error("Failed to fetch rides");
        }
        const data: RideListItem[] = await res.json();
        setRides(data);
      } catch {
        setError("Failed to load rides. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchRides();
  }, []);

  const activeRides = rides.filter((r) => ACTIVE_STATUSES.includes(r.status));
  const pastRides = rides.filter((r) => !ACTIVE_STATUSES.includes(r.status));

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
          Loading rides...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-zinc-400">{error}</p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 bg-[#FF6B2B] text-black font-bold rounded-lg hover:bg-[#FF8B5B] transition-colors"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">My Rides</h2>
        <Link
          href="/rides/new"
          className="px-4 py-2.5 bg-[#FF6B2B] text-black font-bold text-sm rounded-lg hover:bg-[#FF8B5B] transition-colors"
        >
          New Group Ride
        </Link>
      </div>

      {rides.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#141414] border border-[#2A2A2A] flex items-center justify-center">
            <svg
              className="w-8 h-8 text-zinc-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
          </div>
          <p className="text-lg text-white font-semibold">No rides yet</p>
          <p className="text-sm text-zinc-400">
            Create your first group ride and invite your crew.
          </p>
        </div>
      ) : (
        <>
          {activeRides.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                Active
              </p>
              {activeRides.map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))}
            </div>
          )}

          {pastRides.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                Past
              </p>
              {pastRides.map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
