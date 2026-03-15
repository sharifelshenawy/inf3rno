"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import bikeSpecs from "@/data/bikeSpecs.json";
import { computeRangeKm, computeRawRangeKm } from "@/lib/types";

type Step = 1 | 2 | 3 | 4;
type RidingLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

interface BikeSpec {
  make: string;
  model: string;
  year: number;
  tankLitres: number;
  consumptionPer100km: number;
}

interface AddedBike {
  spec: BikeSpec;
  tankLitres: number;
  consumptionPer100km: number;
  isManualRange: boolean;
  manualRangeKm: number | null;
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <p className="text-[#555555]">Loading...</p>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // Step 1: Identity
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [ridingLevel, setRidingLevel] = useState<RidingLevel | null>(null);

  // Step 2: Handle
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState("");
  const [handleChecking, setHandleChecking] = useState(false);
  const [handleValid, setHandleValid] = useState(false);
  const [generatingHandle, setGeneratingHandle] = useState(false);

  // Step 3: Suburb
  const [suburb, setSuburb] = useState("");

  // Step 4: Bikes — cascading Year > Brand > Model
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
  const [addedBikes, setAddedBikes] = useState<AddedBike[]>([]);

  // Flow
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const HANDLE_REGEX = /^[a-zA-Z0-9_]+$/;

  const STEPS: Step[] = [1, 2, 3, 4];

  const STEP_LABELS: Record<Step, string> = {
    1: "Tell us about yourself",
    2: "Choose your handle",
    3: "Where do you ride from?",
    4: "What do you ride?",
  };

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

  // ---- Step 2: Debounced handle uniqueness check ----
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
        // Network error -- don't block the user
        setHandleValid(true);
      } finally {
        setHandleChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [handle]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Generate handle ----
  const generateHandle = useCallback(async () => {
    setGeneratingHandle(true);
    try {
      const res = await fetch("/api/handles/generate");
      if (res.ok) {
        const data = await res.json();
        if (data.handle) {
          setHandle(data.handle);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setGeneratingHandle(false);
    }
  }, []);

  // ---- Step 4: Cascading Year > Brand > Model ----
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

  const handleBrandChange = useCallback(
    (brand: string) => {
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
    },
    []
  );

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

  const computedRange = useMemo(() => {
    if (isManualRange && typeof manualRangeKm === "number") {
      return manualRangeKm;
    }
    return computedSafeRange;
  }, [isManualRange, manualRangeKm, computedSafeRange]);

  const addBike = useCallback(() => {
    if (typeof tankLitres !== "number" || typeof consumptionPer100km !== "number")
      return;
    if (addedBikes.length >= 5) return;

    let bikeSpec: BikeSpec;

    if (selectedBike) {
      bikeSpec = selectedBike;
    } else if (showManualEntry && manualMake.trim() && manualModel.trim() && typeof manualYear === "number") {
      bikeSpec = {
        make: manualMake.trim(),
        model: manualModel.trim(),
        year: manualYear,
        tankLitres,
        consumptionPer100km,
      };
    } else {
      return;
    }

    const newBike: AddedBike = {
      spec: bikeSpec,
      tankLitres,
      consumptionPer100km,
      isManualRange,
      manualRangeKm:
        isManualRange && typeof manualRangeKm === "number"
          ? manualRangeKm
          : null,
    };

    setAddedBikes((prev) => [...prev, newBike]);

    // Reset bike form
    setSelectedBike(null);
    setSelectedYear("");
    setSelectedBrand("");
    setSelectedModel("");
    setShowManualEntry(false);
    setManualMake("");
    setManualModel("");
    setManualYear("");
    setTankLitres("");
    setConsumptionPer100km("");
    setIsManualRange(false);
    setManualRangeKm("");
  }, [
    selectedBike,
    showManualEntry,
    manualMake,
    manualModel,
    manualYear,
    tankLitres,
    consumptionPer100km,
    isManualRange,
    manualRangeKm,
    addedBikes.length,
  ]);

  const removeBike = useCallback((index: number) => {
    setAddedBikes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ---- Step validation ----
  const canProceedStep1 =
    displayName.trim().length > 0 && ridingLevel !== null;

  const canProceedStep2 =
    handle.trim().length >= 3 && handleValid && !handleChecking;

  // ---- Finish ----
  const handleFinish = async () => {
    setSaving(true);
    setError("");

    try {
      // Save profile
      const profilePayload: Record<string, string> = {
        handle: handle.trim(),
        displayName: displayName.trim(),
      };
      if (phone.trim()) {
        profilePayload.phone = phone.trim();
      }
      if (ridingLevel) {
        profilePayload.ridingLevel = ridingLevel;
      }
      if (suburb.trim()) {
        profilePayload.suburb = suburb.trim();
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

      // Save each bike via POST
      for (const bike of addedBikes) {
        const bikePayload: Record<string, unknown> = {
          make: bike.spec.make,
          model: bike.spec.model,
          year: bike.spec.year,
          tankLitres: bike.tankLitres,
          consumptionPer100km: bike.consumptionPer100km,
          isManualRange: bike.isManualRange,
          manualRangeKm: bike.manualRangeKm,
        };

        const bikeRes = await fetch("/api/profile/bike", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bikePayload),
        });

        if (!bikeRes.ok) {
          const data = await bikeRes.json();
          throw new Error(data.error ?? "Failed to save bike");
        }
      }

      // Redirect to callbackUrl or home
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(callbackUrl ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

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
    addedBikes.length < 5;

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-8">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">
            Set up your profile
          </h1>
          <p className="mt-2 text-sm text-[#999999]">{STEP_LABELS[step]}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {STEPS.map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full transition-all ${
                s === step
                  ? "bg-[#FF6B2B] scale-125"
                  : s < step
                    ? "bg-[#FF6B2B]/50"
                    : "bg-[#2A2A2A]"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6">
          {/* ============ STEP 1: Identity ============ */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Display Name */}
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-[#999999] mb-2"
                >
                  Display name <span className="text-red-400">*</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  autoFocus
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
                />
              </div>

              {/* Email (read-only from session) */}
              <div>
                <label className="block text-sm font-medium text-[#999999] mb-2">
                  Email
                </label>
                <div className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-[#777777] text-base">
                  {session?.user?.email ?? "Loading..."}
                </div>
              </div>

              {/* Phone (optional) */}
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
                  Riding level <span className="text-red-400">*</span>
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
                      <p className="text-xs text-[#999999] mt-0.5">
                        {level.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="w-full py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* ============ STEP 2: Handle ============ */}
          {step === 2 && (
            <div className="space-y-5">
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
                    placeholder="your_handle"
                    maxLength={20}
                    autoFocus
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
                <p className="mt-1 text-xs text-[#555555]">
                  3-20 characters, letters, numbers, and underscores
                </p>
              </div>

              {/* Generate handle button */}
              <button
                type="button"
                onClick={generateHandle}
                disabled={generatingHandle}
                className="w-full py-2.5 bg-[#0A0A0A] text-[#FF6B2B] font-semibold text-sm rounded-lg border border-[#2A2A2A] hover:border-[#FF6B2B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generatingHandle ? "Generating..." : "Generate one for me"}
              </button>

              <p className="text-xs text-[#555555] text-center">
                Inappropriate handles will be rejected
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3.5 bg-[#0A0A0A] text-[#999999] font-semibold text-base rounded-lg border border-[#2A2A2A] hover:border-[#555555] transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className="flex-1 py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ============ STEP 3: Home Suburb ============ */}
          {step === 3 && (
            <div className="space-y-5">
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
                  autoFocus
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
                />
                <p className="mt-1 text-xs text-[#555555]">
                  Used to find nearby meeting points and calculate commute
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-3.5 bg-[#0A0A0A] text-[#999999] font-semibold text-base rounded-lg border border-[#2A2A2A] hover:border-[#555555] transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="flex-1 py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] transition-colors"
                >
                  {suburb.trim() ? "Next" : "Skip"}
                </button>
              </div>
            </div>
          )}

          {/* ============ STEP 4: Bikes ============ */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Added bikes list */}
              {addedBikes.length > 0 && (
                <div className="space-y-2">
                  {addedBikes.map((bike, index) => {
                    const range = bike.isManualRange && bike.manualRangeKm !== null
                      ? bike.manualRangeKm
                      : computeRangeKm({
                          tankLitres: bike.tankLitres,
                          consumptionPer100km: bike.consumptionPer100km,
                          isManualRange: false,
                          manualRangeKm: null,
                        });
                    return (
                      <div
                        key={`${bike.spec.make}-${bike.spec.model}-${bike.spec.year}-${index}`}
                        className="flex items-center justify-between bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">
                            {index === 0 && (
                              <span className="text-[#FF6B2B] mr-1.5 text-xs font-bold uppercase">
                                Primary
                              </span>
                            )}
                            {bike.spec.make} {bike.spec.model}
                            <span className="text-[#555555] font-normal">
                              {" "}
                              ({bike.spec.year})
                            </span>
                          </p>
                          <p className="text-xs text-[#999999] mt-0.5">
                            {bike.tankLitres}L tank &middot;{" "}
                            {Math.round(range)} km range
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBike(index)}
                          className="ml-3 p-2 text-[#555555] hover:text-red-400 transition-colors shrink-0"
                          aria-label={`Remove ${bike.spec.make} ${bike.spec.model}`}
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

              {/* Bike entry form (only show if under limit) */}
              {addedBikes.length < 5 && !showManualEntry && (
                <>
                  <p className="text-sm font-medium text-[#999999]">
                    {addedBikes.length === 0 ? "Your bike" : "Add another bike"}
                  </p>

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

                  {/* Brand dropdown — shown after year selected */}
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

                  {/* Model dropdown — shown after brand selected (not for "Other" brand) */}
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
                  {!selectedBike && !showManualEntry && (
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
              {addedBikes.length < 5 && showManualEntry && (
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
                      autoFocus
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

              {/* Tank + Consumption + Range — shown when bike selected or manual entry active */}
              {addedBikes.length < 5 && (selectedBike || showManualEntry) && (
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
                            e.target.value
                              ? parseFloat(e.target.value)
                              : ""
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
                            e.target.value
                              ? parseFloat(e.target.value)
                              : ""
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
                        We&apos;ll plan fuel stops at ~{Math.round(computedSafeRange)} km (80% safety margin)
                      </p>
                    </div>
                  )}

                  {/* Manual range override toggle */}
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isManualRange}
                        onChange={(e) =>
                          setIsManualRange(e.target.checked)
                        }
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
                            e.target.value
                              ? parseFloat(e.target.value)
                              : ""
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
                    disabled={!canAddBike}
                    className="w-full py-2.5 bg-[#0A0A0A] text-[#FF6B2B] font-semibold text-sm rounded-lg border border-[#2A2A2A] hover:border-[#FF6B2B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {addedBikes.length === 0
                      ? "Add bike"
                      : "Add another bike"}
                  </button>
                </>
              )}

              {addedBikes.length >= 5 && (
                <p className="text-xs text-[#555555] text-center">
                  Maximum 5 bikes reached
                </p>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-3.5 bg-[#0A0A0A] text-[#999999] font-semibold text-base rounded-lg border border-[#2A2A2A] hover:border-[#555555] transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-1 py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving
                    ? "Saving..."
                    : addedBikes.length > 0
                      ? "Done"
                      : "Skip"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
