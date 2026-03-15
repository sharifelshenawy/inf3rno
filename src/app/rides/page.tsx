"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import RideCard from "@/components/RideCard";
import routesData from "@/data/routes.json";
import type { Route } from "@/lib/routeMatcher";

interface GroupRideItem {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  memberCount: number;
  vibe: string | null;
  difficulty: string | null;
  createdAt: string;
}

interface SoloRideItem {
  id: string;
  routeId: string;
  vibe: string;
  difficulty: string;
  riderSuburb: string | null;
  bikeMake: string | null;
  bikeModel: string | null;
  rangeKm: number | null;
  createdAt: string;
}

const ACTIVE_STATUSES = ["DRAFT", "VOTING", "LOCKED"];

function getRouteName(routeId: string): string {
  const route = (routesData as Route[]).find((r) => r.id === routeId);
  return route?.name || routeId;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function RidesListPage() {
  const [groupRides, setGroupRides] = useState<GroupRideItem[]>([]);
  const [soloRides, setSoloRides] = useState<SoloRideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"all" | "solo" | "group">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [groupRes, soloRes] = await Promise.all([
          fetch("/api/rides"),
          fetch("/api/solo-rides"),
        ]);

        if (groupRes.ok) {
          setGroupRides(await groupRes.json());
        }
        if (soloRes.ok) {
          setSoloRides(await soloRes.json());
        }
      } catch {
        setError("Failed to load rides.");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const handleDeleteSolo = async (id: string) => {
    if (!confirm("Delete this ride?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/solo-rides?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSoloRides((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      // Silently fail
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Cancel this ride?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/rides/${id}`, { method: "DELETE" });
      if (res.ok) {
        setGroupRides((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r))
        );
      }
    } catch {
      // Silently fail
    } finally {
      setDeletingId(null);
    }
  };

  const activeGroupRides = groupRides.filter((r) => ACTIVE_STATUSES.includes(r.status));
  const pastGroupRides = groupRides.filter((r) => !ACTIVE_STATUSES.includes(r.status));

  const totalCount = groupRides.length + soloRides.length;

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">My Rides</h2>
        <div className="flex gap-2">
          <Link
            href="/plan"
            className="px-3 py-2 border border-[#2A2A2A] text-zinc-400 font-semibold text-sm rounded-lg hover:border-[#FF6B2B]/50 transition-colors"
          >
            Solo
          </Link>
          <Link
            href="/rides/new"
            className="px-3 py-2 bg-[#FF6B2B] text-black font-bold text-sm rounded-lg hover:bg-[#FF8B5B] transition-colors"
          >
            Group
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#141414] rounded-lg p-1 border border-[#2A2A2A]">
        {(["all", "solo", "group"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t
                ? "bg-[#FF6B2B] text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "all" ? `All (${totalCount})` : t === "solo" ? `Solo (${soloRides.length})` : `Group (${groupRides.length})`}
          </button>
        ))}
      </div>

      {totalCount === 0 ? (
        <div className="py-16 text-center space-y-4">
          <p className="text-lg text-white font-semibold">No rides yet</p>
          <p className="text-sm text-zinc-400">
            Plan a solo ride or create a group ride to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Solo rides */}
          {(tab === "all" || tab === "solo") && soloRides.length > 0 && (
            <div className="space-y-3">
              {tab === "all" && (
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Solo Rides
                </p>
              )}
              {soloRides.map((ride) => (
                <div
                  key={ride.id}
                  className="p-4 rounded-lg bg-[#141414] border border-[#2A2A2A] space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-semibold">
                        {getRouteName(ride.routeId)}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {formatDate(ride.createdAt)}
                        {ride.riderSuburb && ` \u2022 from ${ride.riderSuburb}`}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      solo
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>{ride.vibe}</span>
                    <span>&middot;</span>
                    <span>{ride.difficulty}</span>
                    {ride.bikeMake && (
                      <>
                        <span>&middot;</span>
                        <span>{ride.bikeMake} {ride.bikeModel}</span>
                      </>
                    )}
                    {ride.rangeKm && (
                      <>
                        <span>&middot;</span>
                        <span>{Math.round(ride.rangeKm)} km range</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteSolo(ride.id)}
                    disabled={deletingId === ride.id}
                    className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    {deletingId === ride.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Active group rides */}
          {(tab === "all" || tab === "group") && activeGroupRides.length > 0 && (
            <div className="space-y-3">
              {tab === "all" && (
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Active Group Rides
                </p>
              )}
              {activeGroupRides.map((ride) => (
                <div key={ride.id} className="relative">
                  <RideCard ride={ride} />
                  <button
                    onClick={() => handleDeleteGroup(ride.id)}
                    disabled={deletingId === ride.id}
                    className="absolute top-3 right-3 text-xs text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    {deletingId === ride.id ? "..." : "Cancel"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Past group rides */}
          {(tab === "all" || tab === "group") && pastGroupRides.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                Past Group Rides
              </p>
              {pastGroupRides.map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
