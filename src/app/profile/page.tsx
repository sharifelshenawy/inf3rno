"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import bikeSpecs from "@/data/bikeSpecs.json";
import { computeRangeKm } from "@/lib/types";

interface BikeSpec {
  make: string;
  model: string;
  year: number;
  tankLitres: number;
  consumptionPer100km: number;
}

interface UserProfile {
  handle: string | null;
  displayName: string | null;
  suburb: string | null;
  bike: {
    make: string;
    model: string;
    year: number | null;
    tankLitres: number;
    consumptionPer100km: number;
    isManualRange: boolean;
    manualRangeKm: number | null;
  } | null;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Profile fields
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [suburb, setSuburb] = useState("");

  // Handle validation
  const [handleError, setHandleError] = useState("");
  const [handleChecking, setHandleChecking] = useState(false);
  const [handleValid, setHandleValid] = useState(false);
  const [originalHandle, setOriginalHandle] = useState("");

  // Bike fields
  const [bikeSearch, setBikeSearch] = useState("");
  const [selectedBike, setSelectedBike] = useState<BikeSpec | null>(null);
  const [hasBike, setHasBike] = useState(false);
  const [tankLitres, setTankLitres] = useState<number | "">("");
  const [consumptionPer100km, setConsumptionPer100km] = useState<number | "">("");
  const [isManualRange, setIsManualRange] = useState(false);
  const [manualRangeKm, setManualRangeKm] = useState<number | "">("");
  const [bikeDropdownOpen, setBikeDropdownOpen] = useState(false);

  const HANDLE_REGEX = /^[a-zA-Z0-9_]+$/;

  // Load profile
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) throw new Error("Failed to load profile");
        const data: UserProfile = await res.json();

        setHandle(data.handle ?? "");
        setOriginalHandle(data.handle ?? "");
        setDisplayName(data.displayName ?? "");
        setSuburb(data.suburb ?? "");
        setHandleValid(true);

        if (data.bike) {
          setHasBike(true);
          setBikeSearch(`${data.bike.make} ${data.bike.model}${data.bike.year ? ` (${data.bike.year})` : ""}`);
          setSelectedBike({
            make: data.bike.make,
            model: data.bike.model,
            year: data.bike.year ?? 0,
            tankLitres: data.bike.tankLitres,
            consumptionPer100km: data.bike.consumptionPer100km,
          });
          setTankLitres(data.bike.tankLitres);
          setConsumptionPer100km(data.bike.consumptionPer100km);
          setIsManualRange(data.bike.isManualRange);
          setManualRangeKm(data.bike.manualRangeKm ?? "");
        }
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Debounced handle check (only if changed from original)
  useEffect(() => {
    const trimmed = handle.trim();

    if (!trimmed || trimmed.length < 3) {
      setHandleValid(false);
      setHandleError(trimmed.length > 0 ? "Handle must be at least 3 characters" : "");
      return;
    }

    if (trimmed.length > 20) {
      setHandleValid(false);
      setHandleError("Handle must be 20 characters or less");
      return;
    }

    if (!HANDLE_REGEX.test(trimmed)) {
      setHandleValid(false);
      setHandleError("Only letters, numbers, and underscores");
      return;
    }

    // If unchanged from loaded value, it's valid
    if (trimmed.toLowerCase() === originalHandle.toLowerCase()) {
      setHandleValid(true);
      setHandleError("");
      return;
    }

    setHandleError("");
    setHandleChecking(true);
    setHandleValid(false);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/${encodeURIComponent(trimmed.toLowerCase())}`
        );
        if (res.ok) {
          setHandleError("Handle is already taken");
          setHandleValid(false);
        } else if (res.status === 404) {
          setHandleValid(true);
          setHandleError("");
        }
      } catch {
        setHandleValid(true);
      } finally {
        setHandleChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [handle, originalHandle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bike search filtering
  const filteredBikes = useMemo(() => {
    if (!bikeSearch.trim()) return [];
    const term = bikeSearch.toLowerCase();
    return (bikeSpecs as BikeSpec[])
      .filter(
        (b) =>
          `${b.make} ${b.model}`.toLowerCase().includes(term) ||
          b.make.toLowerCase().includes(term) ||
          b.model.toLowerCase().includes(term)
      )
      .slice(0, 10);
  }, [bikeSearch]);

  const selectBike = useCallback((bike: BikeSpec) => {
    setSelectedBike(bike);
    setBikeSearch(`${bike.make} ${bike.model} (${bike.year})`);
    setTankLitres(bike.tankLitres);
    setConsumptionPer100km(bike.consumptionPer100km);
    setBikeDropdownOpen(false);
    setHasBike(true);
  }, []);

  const computedRange = useMemo(() => {
    if (isManualRange && typeof manualRangeKm === "number") {
      return manualRangeKm;
    }
    if (typeof tankLitres === "number" && typeof consumptionPer100km === "number" && consumptionPer100km > 0) {
      return computeRangeKm({
        tankLitres,
        consumptionPer100km,
        isManualRange: false,
        manualRangeKm: null,
      });
    }
    return null;
  }, [tankLitres, consumptionPer100km, isManualRange, manualRangeKm]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // Save profile
      const profilePayload: Record<string, string> = {
        handle: handle.trim(),
        displayName: displayName.trim(),
      };
      profilePayload.suburb = suburb.trim();

      const profileRes = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });

      if (!profileRes.ok) {
        const data = await profileRes.json();
        throw new Error(data.error ?? "Failed to save profile");
      }

      // Save bike if selected
      if (hasBike && selectedBike && typeof tankLitres === "number" && typeof consumptionPer100km === "number") {
        const bikePayload: Record<string, unknown> = {
          make: selectedBike.make,
          model: selectedBike.model,
          year: selectedBike.year || null,
          tankLitres,
          consumptionPer100km,
          isManualRange,
          manualRangeKm: isManualRange && typeof manualRangeKm === "number" ? manualRangeKm : null,
        };

        const bikeRes = await fetch("/api/profile/bike", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bikePayload),
        });

        if (!bikeRes.ok) {
          const data = await bikeRes.json();
          throw new Error(data.error ?? "Failed to save bike");
        }
      }

      setOriginalHandle(handle.trim().toLowerCase());
      setSuccess("Profile saved");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <p className="text-[#555555]">Loading profile...</p>
      </div>
    );
  }

  const canSave =
    handle.trim().length >= 3 &&
    displayName.trim().length > 0 &&
    handleValid &&
    !handleChecking;

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-8">
      <div className="max-w-sm mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Edit Profile</h1>

        {/* Fuel range card (prominent) */}
        {computedRange !== null && (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6 mb-6 text-center">
            <p className="text-xs text-[#999999] uppercase tracking-wide mb-1">
              Fuel range
            </p>
            <p className="text-4xl font-bold text-[#FF6B2B]">
              {Math.round(computedRange)} km
            </p>
            {selectedBike && (
              <p className="text-sm text-[#555555] mt-2">
                {selectedBike.make} {selectedBike.model}
              </p>
            )}
          </div>
        )}

        {/* Profile fields */}
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6 space-y-5">
          {/* Handle */}
          <div>
            <label
              htmlFor="handle"
              className="block text-sm font-medium text-[#999999] mb-2"
            >
              Handle
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">
                @
              </span>
              <input
                id="handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                maxLength={20}
                className="w-full pl-8 pr-10 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
              />
              {handleChecking && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] text-xs">
                  ...
                </span>
              )}
              {handleValid && !handleChecking && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">
                  &#10003;
                </span>
              )}
            </div>
            {handleError && (
              <p className="mt-1 text-xs text-red-400">{handleError}</p>
            )}
          </div>

          {/* Display name */}
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-[#999999] mb-2"
            >
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
            />
          </div>

          {/* Suburb */}
          <div>
            <label
              htmlFor="suburb"
              className="block text-sm font-medium text-[#999999] mb-2"
            >
              Home suburb
            </label>
            <input
              id="suburb"
              type="text"
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
              placeholder="e.g. Richmond, Brunswick"
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
            />
          </div>
        </div>

        {/* Bike section */}
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6 mt-4 space-y-5">
          <h2 className="text-lg font-semibold text-white">Your bike</h2>

          {/* Bike search */}
          <div className="relative">
            <input
              type="text"
              value={bikeSearch}
              onChange={(e) => {
                setBikeSearch(e.target.value);
                setBikeDropdownOpen(true);
                if (!e.target.value.trim()) {
                  setSelectedBike(null);
                  setHasBike(false);
                  setTankLitres("");
                  setConsumptionPer100km("");
                }
              }}
              onFocus={() => {
                if (bikeSearch.trim()) setBikeDropdownOpen(true);
              }}
              placeholder="Search make or model..."
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
            />

            {bikeDropdownOpen && filteredBikes.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg max-h-48 overflow-y-auto">
                {filteredBikes.map((bike, i) => (
                  <button
                    key={`${bike.make}-${bike.model}-${bike.year}-${i}`}
                    type="button"
                    onClick={() => selectBike(bike)}
                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-[#2A2A2A] transition-colors"
                  >
                    <span className="font-semibold">{bike.make}</span>{" "}
                    {bike.model}{" "}
                    <span className="text-[#555555]">({bike.year})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tank + Consumption */}
          {hasBike && selectedBike && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="tank"
                    className="block text-xs font-medium text-[#999999] mb-1"
                  >
                    Tank (L)
                  </label>
                  <input
                    id="tank"
                    type="number"
                    value={tankLitres}
                    onChange={(e) =>
                      setTankLitres(
                        e.target.value ? parseFloat(e.target.value) : ""
                      )
                    }
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white text-sm focus:outline-none focus:border-[#FF6B2B] transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="consumption"
                    className="block text-xs font-medium text-[#999999] mb-1"
                  >
                    L/100km
                  </label>
                  <input
                    id="consumption"
                    type="number"
                    value={consumptionPer100km}
                    onChange={(e) =>
                      setConsumptionPer100km(
                        e.target.value ? parseFloat(e.target.value) : ""
                      )
                    }
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white text-sm focus:outline-none focus:border-[#FF6B2B] transition-colors"
                  />
                </div>
              </div>

              {/* Manual range toggle */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isManualRange}
                    onChange={(e) => setIsManualRange(e.target.checked)}
                    className="w-4 h-4 rounded border-[#2A2A2A] bg-[#0A0A0A] text-[#FF6B2B] focus:ring-[#FF6B2B] focus:ring-offset-0"
                  />
                  <span className="text-sm text-[#999999]">
                    Override with manual range
                  </span>
                </label>

                {isManualRange && (
                  <input
                    type="number"
                    value={manualRangeKm}
                    onChange={(e) =>
                      setManualRangeKm(
                        e.target.value ? parseFloat(e.target.value) : ""
                      )
                    }
                    placeholder="Range in km"
                    min="0"
                    className="mt-2 w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-sm focus:outline-none focus:border-[#FF6B2B] transition-colors"
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Errors / success */}
        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}
        {success && (
          <p className="mt-4 text-sm text-green-400 text-center">{success}</p>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="mt-6 w-full py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </div>
  );
}
