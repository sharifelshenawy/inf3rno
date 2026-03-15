"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import bikeSpecs from "@/data/bikeSpecs.json";
import { computeRangeKm, computeRawRangeKm } from "@/lib/types";

interface BikeSpec {
  make: string;
  model: string;
  year: number;
  tankLitres: number;
  consumptionPer100km: number;
}

type RidingLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

interface SavedBike {
  id: string;
  make: string;
  model: string;
  year: number | null;
  tankLitres: number;
  consumptionPer100km: number;
  isManualRange: boolean;
  manualRangeKm: number | null;
  isPrimary: boolean;
}

interface UserProfile {
  handle: string | null;
  displayName: string | null;
  suburb: string | null;
  phone: string | null;
  ridingLevel: RidingLevel | null;
  bikes: SavedBike[];
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Profile fields
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [suburb, setSuburb] = useState("");
  const [phone, setPhone] = useState("");
  const [ridingLevel, setRidingLevel] = useState<RidingLevel | null>(null);

  // Handle validation
  const [handleError, setHandleError] = useState("");
  const [handleChecking, setHandleChecking] = useState(false);
  const [handleValid, setHandleValid] = useState(false);
  const [originalHandle, setOriginalHandle] = useState("");

  // Saved bikes from API
  const [savedBikes, setSavedBikes] = useState<SavedBike[]>([]);

  // New bike form — cascading Year > Brand > Model
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualMake, setManualMake] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualYear, setManualYear] = useState<number | "">("");
  const [selectedBike, setSelectedBike] = useState<BikeSpec | null>(null);
  const [tankLitres, setTankLitres] = useState<number | "">("");
  const [consumptionPer100km, setConsumptionPer100km] = useState<number | "">(
    ""
  );
  const [isManualRange, setIsManualRange] = useState(false);
  const [manualRangeKm, setManualRangeKm] = useState<number | "">("");
  const [showBikeForm, setShowBikeForm] = useState(false);
  const [addingBike, setAddingBike] = useState(false);
  const [removingBikeId, setRemovingBikeId] = useState<string | null>(null);

  const HANDLE_REGEX = /^[a-zA-Z0-9_]+$/;

  const RIDING_LEVELS: { value: RidingLevel; label: string; desc: string }[] = [
    {
      value: "BEGINNER",
      label: "Beginner",
      desc: "New to riding or prefer easy routes",
    },
    {
      value: "INTERMEDIATE",
      label: "Intermediate",
      desc: "Comfortable on most roads",
    },
    {
      value: "ADVANCED",
      label: "Advanced",
      desc: "Experienced, bring on the twisties",
    },
  ];

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
        setPhone(data.phone ?? "");
        setRidingLevel(data.ridingLevel ?? null);
        setHandleValid(true);

        if (data.bikes && data.bikes.length > 0) {
          setSavedBikes(data.bikes);
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
      setHandleError(
        trimmed.length > 0 ? "Handle must be at least 3 characters" : ""
      );
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

  // ---- Cascading Year > Brand > Model ----
  const allSpecs = bikeSpecs as BikeSpec[];

  const uniqueYears = useMemo(() => {
    const years = [...new Set(allSpecs.map((b) => b.year))].sort(
      (a, b) => b - a
    );
    return years;
  }, [allSpecs]);

  const brandsForYear = useMemo(() => {
    if (!selectedYear) return [];
    const filtered =
      selectedYear === "Other"
        ? allSpecs
        : allSpecs.filter((b) => b.year === parseInt(selectedYear, 10));
    return [...new Set(filtered.map((b) => b.make))].sort();
  }, [selectedYear, allSpecs]);

  const modelsForBrandYear = useMemo(() => {
    if (!selectedBrand || selectedBrand === "Other") return [];
    const filtered =
      selectedYear === "Other"
        ? allSpecs.filter((b) => b.make === selectedBrand)
        : allSpecs.filter(
            (b) =>
              b.year === parseInt(selectedYear, 10) &&
              b.make === selectedBrand
          );
    return [...new Set(filtered.map((b) => b.model))].sort();
  }, [selectedYear, selectedBrand, allSpecs]);

  const handleYearChange = useCallback((year: string) => {
    setSelectedYear(year);
    setSelectedBrand("");
    setSelectedModel("");
    setSelectedBike(null);
    setShowManualEntry(false);
    setTankLitres("");
    setConsumptionPer100km("");
    setIsManualRange(false);
    setManualRangeKm("");
  }, []);

  const handleBrandChange = useCallback((brand: string) => {
    setSelectedBrand(brand);
    setSelectedModel("");
    setSelectedBike(null);
    setTankLitres("");
    setConsumptionPer100km("");
    setIsManualRange(false);
    setManualRangeKm("");
    if (brand === "Other") {
      setShowManualEntry(true);
    } else {
      setShowManualEntry(false);
    }
  }, []);

  const handleModelChange = useCallback(
    (model: string) => {
      setSelectedModel(model);
      if (model === "Other") {
        setShowManualEntry(true);
        setSelectedBike(null);
        setTankLitres("");
        setConsumptionPer100km("");
      } else {
        setShowManualEntry(false);
        const yearNum =
          selectedYear === "Other" ? undefined : parseInt(selectedYear, 10);
        const match = allSpecs.find(
          (b) =>
            b.make === selectedBrand &&
            b.model === model &&
            (yearNum === undefined || b.year === yearNum)
        );
        if (match) {
          setSelectedBike(match);
          setTankLitres(match.tankLitres);
          setConsumptionPer100km(match.consumptionPer100km);
          setIsManualRange(false);
          setManualRangeKm("");
        }
      }
    },
    [selectedYear, selectedBrand, allSpecs]
  );

  const handleShowManualEntry = useCallback(() => {
    setShowManualEntry(true);
    setSelectedYear("");
    setSelectedBrand("");
    setSelectedModel("");
    setSelectedBike(null);
    setTankLitres("");
    setConsumptionPer100km("");
    setIsManualRange(false);
    setManualRangeKm("");
  }, []);

  const resetBikeForm = useCallback(() => {
    setSelectedYear("");
    setSelectedBrand("");
    setSelectedModel("");
    setSelectedBike(null);
    setShowManualEntry(false);
    setManualMake("");
    setManualModel("");
    setManualYear("");
    setTankLitres("");
    setConsumptionPer100km("");
    setIsManualRange(false);
    setManualRangeKm("");
    setShowBikeForm(false);
  }, []);

  const computedRawRange = useMemo(() => {
    if (
      typeof tankLitres === "number" &&
      typeof consumptionPer100km === "number" &&
      consumptionPer100km > 0
    ) {
      return computeRawRangeKm({
        tankLitres,
        consumptionPer100km,
        isManualRange: false,
        manualRangeKm: null,
      });
    }
    return null;
  }, [tankLitres, consumptionPer100km]);

  const computedSafeRange = useMemo(() => {
    if (
      typeof tankLitres === "number" &&
      typeof consumptionPer100km === "number" &&
      consumptionPer100km > 0
    ) {
      return computeRangeKm({
        tankLitres,
        consumptionPer100km,
        isManualRange: false,
        manualRangeKm: null,
      });
    }
    return null;
  }, [tankLitres, consumptionPer100km]);

  const hasBikeIdentity =
    selectedBike !== null ||
    (showManualEntry &&
      manualMake.trim().length > 0 &&
      manualModel.trim().length > 0 &&
      typeof manualYear === "number");

  const canAddBike =
    hasBikeIdentity &&
    typeof tankLitres === "number" &&
    typeof consumptionPer100km === "number" &&
    savedBikes.length < 5;

  // ---- Add bike via POST ----
  const addBike = useCallback(async () => {
    if (!canAddBike) return;
    setAddingBike(true);
    setError("");

    try {
      let make: string;
      let model: string;
      let year: number | null;

      if (selectedBike) {
        make = selectedBike.make;
        model = selectedBike.model;
        year = selectedBike.year;
      } else if (
        showManualEntry &&
        manualMake.trim() &&
        manualModel.trim() &&
        typeof manualYear === "number"
      ) {
        make = manualMake.trim();
        model = manualModel.trim();
        year = manualYear;
      } else {
        return;
      }

      const payload: Record<string, unknown> = {
        make,
        model,
        year,
        tankLitres,
        consumptionPer100km,
        isManualRange,
        manualRangeKm:
          isManualRange && typeof manualRangeKm === "number"
            ? manualRangeKm
            : null,
      };

      const res = await fetch("/api/profile/bike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add bike");
      }

      const newBike: SavedBike = await res.json();
      setSavedBikes((prev) => [...prev, newBike]);
      resetBikeForm();
      setSuccess("Bike added");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add bike");
    } finally {
      setAddingBike(false);
    }
  }, [
    canAddBike,
    selectedBike,
    showManualEntry,
    manualMake,
    manualModel,
    manualYear,
    tankLitres,
    consumptionPer100km,
    isManualRange,
    manualRangeKm,
    resetBikeForm,
  ]);

  // ---- Remove bike via DELETE ----
  const removeBike = useCallback(async (bikeId: string) => {
    setRemovingBikeId(bikeId);
    setError("");

    try {
      const res = await fetch(
        `/api/profile/bike?id=${encodeURIComponent(bikeId)}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to remove bike");
      }

      setSavedBikes((prev) => {
        const remaining = prev.filter((b) => b.id !== bikeId);
        // If we removed the primary bike, the API auto-promotes the first remaining one
        if (
          remaining.length > 0 &&
          !remaining.some((b) => b.isPrimary)
        ) {
          remaining[0] = { ...remaining[0], isPrimary: true };
        }
        return remaining;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove bike");
    } finally {
      setRemovingBikeId(null);
    }
  }, []);

  // ---- Save profile fields ----
  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const profilePayload: Record<string, string> = {
        handle: handle.trim(),
        displayName: displayName.trim(),
      };
      profilePayload.suburb = suburb.trim();
      if (phone.trim()) {
        profilePayload.phone = phone.trim();
      }
      if (ridingLevel) {
        profilePayload.ridingLevel = ridingLevel;
      }

      const profileRes = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });

      if (!profileRes.ok) {
        const data = await profileRes.json();
        throw new Error(data.error ?? "Failed to save profile");
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

        {/* Primary bike fuel range card */}
        {savedBikes.length > 0 && (() => {
          const primary = savedBikes.find((b) => b.isPrimary) ?? savedBikes[0];
          const range =
            primary.isManualRange && primary.manualRangeKm !== null
              ? primary.manualRangeKm
              : computeRangeKm({
                  tankLitres: primary.tankLitres,
                  consumptionPer100km: primary.consumptionPer100km,
                  isManualRange: false,
                  manualRangeKm: null,
                });
          return (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6 mb-6 text-center">
              <p className="text-xs text-[#999999] uppercase tracking-wide mb-1">
                Fuel range
              </p>
              <p className="text-4xl font-bold text-[#FF6B2B]">
                {Math.round(range)} km
              </p>
              <p className="text-sm text-[#555555] mt-2">
                {primary.make} {primary.model}
              </p>
            </div>
          );
        })()}

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

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-[#999999] mb-2"
            >
              Phone{" "}
              <span className="text-[#555555] font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0400 000 000"
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
            />
          </div>

          {/* Riding Level */}
          <div>
            <label className="block text-sm font-medium text-[#999999] mb-3">
              Riding level
            </label>
            <div className="space-y-2">
              {RIDING_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setRidingLevel(level.value)}
                  className={`w-full text-left px-4 py-4 rounded-lg border transition-all ${
                    ridingLevel === level.value
                      ? "border-[#FF6B2B] bg-[#FF6B2B]/10"
                      : "border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#555555]"
                  }`}
                >
                  <p
                    className={`font-semibold text-base ${ridingLevel === level.value ? "text-[#FF6B2B]" : "text-white"}`}
                  >
                    {level.label}
                  </p>
                  <p className="text-xs text-[#999999] mt-0.5">{level.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Save profile button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="mt-4 w-full py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>

        {/* Bike section */}
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6 mt-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Your bikes</h2>

          {/* Existing bikes list */}
          {savedBikes.length > 0 && (
            <div className="space-y-2">
              {savedBikes.map((bike) => {
                const range =
                  bike.isManualRange && bike.manualRangeKm !== null
                    ? bike.manualRangeKm
                    : computeRangeKm({
                        tankLitres: bike.tankLitres,
                        consumptionPer100km: bike.consumptionPer100km,
                        isManualRange: false,
                        manualRangeKm: null,
                      });
                return (
                  <div
                    key={bike.id}
                    className="flex items-center justify-between bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">
                        {bike.isPrimary && (
                          <span className="text-[#FF6B2B] mr-1.5 text-xs font-bold uppercase">
                            Primary
                          </span>
                        )}
                        {bike.make} {bike.model}
                        {bike.year && (
                          <span className="text-[#555555] font-normal">
                            {" "}
                            ({bike.year})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#999999] mt-0.5">
                        {bike.tankLitres}L tank &middot;{" "}
                        {Math.round(range)} km range
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBike(bike.id)}
                      disabled={removingBikeId === bike.id}
                      className="ml-3 p-2 text-[#555555] hover:text-red-400 disabled:opacity-50 transition-colors shrink-0"
                      aria-label={`Remove ${bike.make} ${bike.model}`}
                    >
                      <svg
                        className="w-4 h-4"
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
                  </div>
                );
              })}
            </div>
          )}

          {/* Add another bike button (when form is hidden) */}
          {!showBikeForm && savedBikes.length < 5 && (
            <button
              type="button"
              onClick={() => setShowBikeForm(true)}
              className="w-full py-2.5 bg-[#0A0A0A] text-[#FF6B2B] font-semibold text-sm rounded-lg border border-[#2A2A2A] hover:border-[#FF6B2B] transition-colors"
            >
              {savedBikes.length === 0 ? "Add a bike" : "Add another bike"}
            </button>
          )}

          {savedBikes.length >= 5 && !showBikeForm && (
            <p className="text-xs text-[#555555] text-center">
              Maximum 5 bikes reached
            </p>
          )}

          {/* New bike form */}
          {showBikeForm && savedBikes.length < 5 && (
            <div className="space-y-4 border-t border-[#2A2A2A] pt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#999999]">
                  New bike
                </p>
                <button
                  type="button"
                  onClick={resetBikeForm}
                  className="text-xs text-[#FF6B2B] hover:underline"
                >
                  Cancel
                </button>
              </div>

              {/* Cascading dropdowns (when not in manual mode) */}
              {!showManualEntry && (
                <>
                  {/* Year dropdown */}
                  <div>
                    <label
                      htmlFor="bikeYear"
                      className="block text-xs font-medium text-[#999999] mb-1"
                    >
                      Year
                    </label>
                    <select
                      id="bikeYear"
                      value={selectedYear}
                      onChange={(e) => handleYearChange(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white text-base focus:outline-none focus:border-[#FF6B2B] transition-colors appearance-none"
                    >
                      <option value="" disabled>
                        Select year...
                      </option>
                      {uniqueYears.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Brand dropdown */}
                  {selectedYear && (
                    <div>
                      <label
                        htmlFor="bikeBrand"
                        className="block text-xs font-medium text-[#999999] mb-1"
                      >
                        Brand
                      </label>
                      <select
                        id="bikeBrand"
                        value={selectedBrand}
                        onChange={(e) => handleBrandChange(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white text-base focus:outline-none focus:border-[#FF6B2B] transition-colors appearance-none"
                      >
                        <option value="" disabled>
                          Select brand...
                        </option>
                        {brandsForYear.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  )}

                  {/* Model dropdown */}
                  {selectedBrand && selectedBrand !== "Other" && (
                    <div>
                      <label
                        htmlFor="bikeModel"
                        className="block text-xs font-medium text-[#999999] mb-1"
                      >
                        Model
                      </label>
                      <select
                        id="bikeModel"
                        value={selectedModel}
                        onChange={(e) => handleModelChange(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white text-base focus:outline-none focus:border-[#FF6B2B] transition-colors appearance-none"
                      >
                        <option value="" disabled>
                          Select model...
                        </option>
                        {modelsForBrandYear.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  )}

                  {/* "My bike isn't listed" link */}
                  {!selectedBike && (
                    <button
                      type="button"
                      onClick={handleShowManualEntry}
                      className="text-sm text-[#FF6B2B] hover:underline"
                    >
                      My bike isn&apos;t listed
                    </button>
                  )}
                </>
              )}

              {/* Manual entry fields */}
              {showManualEntry && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#999999]">
                      Enter bike details
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualEntry(false);
                        setManualMake("");
                        setManualModel("");
                        setManualYear("");
                        setTankLitres("");
                        setConsumptionPer100km("");
                        setIsManualRange(false);
                        setManualRangeKm("");
                      }}
                      className="text-xs text-[#FF6B2B] hover:underline"
                    >
                      Back to search
                    </button>
                  </div>
                  <div>
                    <label
                      htmlFor="manualMake"
                      className="block text-xs font-medium text-[#999999] mb-1"
                    >
                      Make
                    </label>
                    <input
                      id="manualMake"
                      type="text"
                      value={manualMake}
                      onChange={(e) => setManualMake(e.target.value)}
                      placeholder="e.g. Honda"
                      className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="manualModelName"
                      className="block text-xs font-medium text-[#999999] mb-1"
                    >
                      Model
                    </label>
                    <input
                      id="manualModelName"
                      type="text"
                      value={manualModel}
                      onChange={(e) => setManualModel(e.target.value)}
                      placeholder="e.g. CB500F"
                      className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="manualYearInput"
                      className="block text-xs font-medium text-[#999999] mb-1"
                    >
                      Year
                    </label>
                    <input
                      id="manualYearInput"
                      type="number"
                      value={manualYear}
                      onChange={(e) =>
                        setManualYear(
                          e.target.value ? parseInt(e.target.value, 10) : ""
                        )
                      }
                      placeholder="e.g. 2024"
                      min="1900"
                      max="2100"
                      className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
                    />
                  </div>
                </>
              )}

              {/* Tank + Consumption + Range */}
              {(selectedBike || showManualEntry) && (
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

                  {/* Range display */}
                  {computedRawRange !== null && computedSafeRange !== null && (
                    <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-4 text-center">
                      <p className="text-xs text-[#999999] uppercase tracking-wide mb-1">
                        Fuel range
                      </p>
                      <p className="text-3xl font-bold text-[#FF6B2B]">
                        {Math.round(computedRawRange)} km
                      </p>
                      <p className="text-xs text-[#999999] mt-2">
                        We&apos;ll plan fuel stops at ~
                        {Math.round(computedSafeRange)} km (80% safety margin)
                      </p>
                    </div>
                  )}

                  {/* Manual range override toggle */}
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

                  {/* Add bike button */}
                  <button
                    type="button"
                    onClick={addBike}
                    disabled={!canAddBike || addingBike}
                    className="w-full py-2.5 bg-[#0A0A0A] text-[#FF6B2B] font-semibold text-sm rounded-lg border border-[#2A2A2A] hover:border-[#FF6B2B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {addingBike ? "Adding..." : "Add bike"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Errors / success */}
        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}
        {success && (
          <p className="mt-4 text-sm text-green-400 text-center">{success}</p>
        )}
      </div>
    </div>
  );
}
