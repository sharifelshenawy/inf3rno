"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import RideCard from "@/components/RideCard";
import SwipeableCard from "@/components/SwipeableCard";
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
  creatorId: string;
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
  const { data: session } = useSession();
  const sessionUser = session?.user as { id?: string } | undefined;
  const currentUserId = sessionUser?.id;

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

  const handleLeaveGroup = async (id: string) => {
    if (!currentUserId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/rides/${id}/members/${currentUserId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setGroupRides((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      // Silently fail
    } finally {
      setDeletingId(null);
    }
  };

  /** Returns whether the current user is the leader of a group ride */
  const isLeader = (ride: GroupRideItem): boolean => {
    return currentUserId !== undefined && ride.creatorId === currentUserId;
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
      <h2 className="text-2xl font-bold text-white">My Rides</h2>

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
                <SwipeableCard
                  key={ride.id}
                  actionLabel="Delete"
                  desktopLabel="Delete"
                  confirmMessage="Delete this ride?"
                  isLoading={deletingId === ride.id}
                  onAction={() => handleDeleteSolo(ride.id)}
                >
                  <Link href="/plan" className="block p-4 rounded-xl bg-[#141414] border border-[#2A2A2A] space-y-2 hover:border-[#3A3A3A] transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-white font-semibold truncate">
                          {getRouteName(ride.routeId)}
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {formatDate(ride.createdAt)}
                          {ride.riderSuburb && ` \u2022 from ${ride.riderSuburb}`}
                        </p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 whitespace-nowrap">
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
                  </Link>
                </SwipeableCard>
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
              {activeGroupRides.map((ride) => {
                const leader = isLeader(ride);
                return (
                  <SwipeableCard
                    key={ride.id}
                    actionLabel={leader ? "Cancel" : "Leave"}
                    desktopLabel={leader ? "Cancel" : "Leave"}
                    confirmMessage={
                      leader
                        ? "Cancel this ride for everyone?"
                        : "Leave this ride?"
                    }
                    isLoading={deletingId === ride.id}
                    onAction={() =>
                      leader
                        ? handleDeleteGroup(ride.id)
                        : handleLeaveGroup(ride.id)
                    }
                  >
                    <RideCard ride={ride} />
                  </SwipeableCard>
                );
              })}
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
